import { html, css, LitElement, TemplateResult, nothing } from "lit";
import { customElement, state, property } from "lit/decorators.js";
import cssReset from "./css/reset";
import cssButton from "./css/button";
import cssInput from "./css/input";
import cssEntityTable from "./css/esp-entity-table";
import cssTab from "./css/tab";
import "./esp-entity-chart";
import "iconify-icon";

interface entityConfig {
  unique_id: string;
  sorting_weight: number;
  sorting_group?: string;
  domain: string;
  id: string;
  state: string;
  detail: string;
  value: string;
  name: string;
  entity_category?: number;
  when: string;
  icon?: string;
  option?: string[];
  assumed_state?: boolean;
  brightness?: number;
  color_mode?: string;
  color: object;
  target_temperature?: number;
  target_temperature_low?: number;
  target_temperature_high?: number;
  min_temp?: number;
  max_temp?: number;
  min_value?: string;
  max_value?: string;
  step?: number;
  min_length?: number;
  max_length?: number;
  pattern?: string;
  current_temperature?: number;
  modes?: number[];
  mode?: number;
  speed_count?: number;
  speed_level?: number;
  speed: string;
  effects?: string[];
  effect?: string;
  has_action?: boolean;
  value_numeric_history: number[];
  uom?: string;
  is_disabled_by_default?: boolean;
  position?: number;
}

interface groupConfig {
  name: string;
  sorting_weight: number;  
}

export const stateOn = "ON";
export const stateOff = "OFF";

export function getBasePath() {
  let str = window.location.pathname;
  return str.endsWith("/") ? str.slice(0, -1) : str;
}

interface RestAction {
  restAction(entity?: entityConfig, action?: string): void;
}

@customElement("esp-entity-table")
export class EntityTable extends LitElement implements RestAction {
  @state() entities: entityConfig[] = [];
  @state() has_controls: boolean = false;
  @state() show_all: boolean = false;

  private _actionRenderer = new ActionRenderer();
  private _basePath = getBasePath();
  private groups: groupConfig[] = [] 
  private static ENTITY_UNDEFINED = "States";
  private static ENTITY_CATEGORIES = [
    "Sensor and Control",
    "Configuration",
    "Diagnostic",
  ];

  private _unknown_state_events: {[key: string]: number} = {};

  connectedCallback() {
    super.connectedCallback();

    window.source?.addEventListener('state', (e: Event) => {
      const messageEvent = e as MessageEvent;
      const data = JSON.parse(messageEvent.data);
      let idx = this.entities.findIndex((x) => x.unique_id === data.id);
      if (idx != -1 && data.id) {
        if (typeof data.value === 'number') {
          let history = [...this.entities[idx].value_numeric_history];
          history.push(data.value);
          this.entities[idx].value_numeric_history = history.splice(-50);
        }

        delete data.id;
        delete data.domain;
        delete data.unique_id;
        Object.assign(this.entities[idx], data);
        this.requestUpdate();
      } else {
        // is it a `detail_all` event already?
        if (data?.name) {
          this.addEntity(data);
        } else {
          if (this._unknown_state_events[data.id]) {
            this._unknown_state_events[data.id]++;
          } else {
            this._unknown_state_events[data.id] = 1;
          }
          // ignore the first few events, maybe the esp will send a detail_all
          // event soon
          if (this._unknown_state_events[data.id] < 1) {
            return;
          }

          let parts = data.id.split('-');
          let domain = parts[0];
          let id = parts.slice(1).join('-');

          fetch(`${this._basePath}/${domain}/${id}?detail=all`, {
            method: 'GET',
          })
              .then((r) => {
                console.log(r);
                if (!r.ok) {
                  throw new Error(`HTTP error! Status: ${r.status}`);
                }
                return r.json();
              })
              .then((data) => {
                console.log(data);
                this.addEntity(data);
              })
              .catch((error) => {
                console.error('Fetch error:', error);
              });
        }
      }
    });

    window.source?.addEventListener("sorting_group", (e: Event) => {
      const messageEvent = e as MessageEvent;
      const data = JSON.parse(messageEvent.data);
      const groupIndex = this.groups.findIndex((x) => x.name === data.name);
      if (groupIndex === -1) {
        let group = {
           ...data,
        } as groupConfig;
        this.groups.push(group);
        this.groups.sort((a, b) => {
          return a.sorting_weight < b.sorting_weight  
            ? -1  
            : 1  
        });
      }
    });

    this.groups = EntityTable.ENTITY_CATEGORIES.map((category, index) => ({
      name: category,
      sorting_weight: index
    }));

    this.groups.push({
      name: EntityTable.ENTITY_UNDEFINED,
      sorting_weight: -1 
    });
  }

  addEntity(data: any) {
    let idx = this.entities.findIndex((x) => x.unique_id === data.id);
    if (idx === -1 && data.id) {
      // Dynamically add discovered..
      let parts = data.id.split("-");
      let entity = {
        ...data,
        domain: parts[0],
        unique_id: data.id,
        id: parts.slice(1).join("-"),
        entity_category: data.entity_category,
        sorting_group: data.sorting_group ?? (EntityTable.ENTITY_CATEGORIES[parseInt(data.entity_category)] || EntityTable.ENTITY_UNDEFINED),
        value_numeric_history: [data.value],
      } as entityConfig;
      entity.has_action = this.hasAction(entity);
      if (entity.has_action) {
        this.has_controls = true;
      }
      this.entities.push(entity);
      this.entities.sort((a, b) => {  
        const sortA = a.sorting_weight ?? a.name;  
        const sortB = b.sorting_weight ?? b.name;  
        return a.sorting_group < b.sorting_group
          ? -1  
          : a.sorting_group === b.sorting_group
          ? sortA === sortB
            ? a.name.toLowerCase() < b.name.toLowerCase()
              ? -1
              : 1
            : sortA < sortB
              ? -1
              : 1
          : 1
      });
      this.requestUpdate();
    }
    
  }

  hasAction(entity: entityConfig): boolean {
    return `render_${entity.domain}` in this._actionRenderer;
  }

  control(entity: entityConfig) {
    this._actionRenderer.entity = entity;
    this._actionRenderer.actioner = this;
    return this._actionRenderer.exec(
      `render_${entity.domain}` as ActionRendererMethodKey
    );
  }

  restAction(entity: entityConfig, action: string) {
    fetch(`${this._basePath}/${entity.domain}/${entity.id}/${action}`, {
      method: "POST",
      headers:{
        'Content-Type': 'application/x-www-form-urlencoded'
      },
    }).then((r) => {
      console.log(r);
    });
  }

  renderShowAll() {
    if (
      !this.show_all &&
      this.entities.find((elem) => elem.is_disabled_by_default)
    ) {
      return html`<div class="singlebutton-row">
        <button
          class="abutton"
          @click="${(e: Event) => (this.show_all = true)}"
        >
          Show All
        </button>
      </div>`;
    }
  }

  render() {
    const groupBy = (xs: Array<any>, key: string): Map<string, Array<any>> => {
      const groupedMap = xs.reduce(function (rv, x) {
        (
          rv.get(x[key]) ||
          (() => {
            let tmp: Array<any> = [];
            rv.set(x[key], tmp);
            return tmp;
          })()
        ).push(x);
        return rv;
      }, new Map<string, Array<any>>());
      
      const sortedGroupedMap = new Map<string, Array<any>>();
      for (const group of this.groups) {
        const groupName = group.name;
        if (groupedMap.has(groupName)) {
          sortedGroupedMap.set(groupName, groupedMap.get(groupName) || []);
        }
      }

      return sortedGroupedMap;
    }

    const entities = this.show_all
      ? this.entities
      : this.entities.filter((elem) => !elem.is_disabled_by_default);
    const grouped = groupBy(entities, "sorting_group");
    const elems = Array.from(grouped, ([name, value]) => ({ name, value }));
    return html`
      <div>
        ${elems.map(
          (group) => html`
            <div 
              class="tab-header"
              @dblclick="${this._handleTabHeaderDblClick}"
            >
              ${group.name ||
              EntityTable.ENTITY_UNDEFINED}
            </div>
            <div class="tab-container">
              ${group.value.map(
                (component, idx) => html`
                  <div
                    class="entity-row"
                    .domain="${component.domain}"
                    @click="${this._handleEntityRowClick}"
                  >
                    <div>
                      ${component.icon
                        ? html`<iconify-icon
                            icon="${component.icon}"
                            height="24px"
                          ></iconify-icon>`
                        : nothing}
                    </div>
                    <div>${component.name}</div>
                    <div>
                      ${this.has_controls && component.has_action
                        ? this.control(component)
                        : html`<div>${component.state}</div>`}
                    </div>
                    ${component.domain === "sensor"
                      ? html`<esp-entity-chart
                          .chartdata="${component.value_numeric_history}"
                        ></esp-entity-chart>`
                      : nothing}
                  </div>
                `
              )}
            </div>
          `
        )}
        ${this.renderShowAll()}
      </div>
    `;
  }

  static get styles() {
    return [cssReset, cssButton, cssInput, cssEntityTable, cssTab];
  }

  _handleEntityRowClick(e: any) {
    if (e?.currentTarget?.domain === "sensor") {
      if (!e?.ctrlKey) e.stopPropagation();
      e?.currentTarget?.classList.toggle(
        "expanded",
        !e.ctrlKey ? undefined : true
      );
    }
  }
  _handleTabHeaderDblClick(e: Event) {
    const doubleClickEvent = new CustomEvent('entity-tab-header-double-clicked', {
      bubbles: true,
      composed: true,
    });
    e.target?.dispatchEvent(doubleClickEvent);
  }
}


type ActionRendererNonCallable = "entity" | "actioner" | "exec";
type ActionRendererMethodKey = keyof Omit<
  ActionRenderer,
  ActionRendererNonCallable
>;

class ActionRenderer {
  public entity?: entityConfig;
  public actioner?: RestAction;

  exec(method: ActionRendererMethodKey) {
    if (!this[method] || typeof this[method] !== "function") {
      console.log(`ActionRenderer.${method} is not callable`);
      return;
    }
    return this[method]();
  }

  private _actionButton(entity: entityConfig, label: string, action: string) {
    if (!entity) return;
    let a = action || label.toLowerCase();
    return html`<button
      class="abutton"
      @click=${() => this.actioner?.restAction(entity, a)}
    >
      ${label}
    </button>`;
  }

  private _datetime(
    entity: entityConfig,
    type: string,
    action: string,
    opt: string,
    value: string,
  ) {
    return html`
      <input 
        type="${type}" 
        name="${entity.unique_id}"
        id="${entity.unique_id}"
        .value="${value}"
        @change="${(e: Event) => {
          const val = (<HTMLTextAreaElement>e.target)?.value;
          this.actioner?.restAction(
            entity,
            `${action}?${opt}=${val.replace('T', ' ')}`
          );
        }}"
      />
    `;
  }

  private _switch(entity: entityConfig) {
    return html`<esp-switch
      color="var(--primary-color,currentColor)"
      .state=${entity.state}
      @state="${(e: CustomEvent) => {
        let act = "turn_" + e.detail.state;
        this.actioner?.restAction(entity, act.toLowerCase());
      }}"
    ></esp-switch>`;
  }

  private _valve_switch(entity: entityConfig) {
    const action_map = {
      open: "open",
      closed: "close",
    };
    return html`<esp-switch
      color="var(--primary-color,currentColor)"
      stateOn="OPEN"
      stateOff="CLOSED"
      .state=${entity.state}
      @state="${(e: CustomEvent) => {
        let act = action_map[e.detail.state.toLowerCase()];
        this.actioner?.restAction(entity, act);
      }}"
    ></esp-switch>`;
  }

  private _select(
    entity: entityConfig,
    action: string,
    opt: string,
    options: string[] | number[],
    val: string | number | undefined
  ) {
    return html`<select
      @change="${(e: Event) => {
        const val = (<HTMLTextAreaElement>e.target)?.value;
        this.actioner?.restAction(
          entity,
          `${action}?${opt}=${encodeURIComponent(val)}`
        );
      }}"
    >
      ${options.map(
        (option) =>
          html`
            <option value="${option}" ?selected="${option == val}">
              ${option}
            </option>
          `
      )}
    </select>`;
  }

  private _range(
    entity: entityConfig,
    action: string,
    opt: string,
    value: string | number,
    min?: string | undefined,
    max?: string | undefined,
    step = 1
  ) {
    if(entity.mode == 1) {
      return html`<div class="range">
        <label>${min || 0}</label>
        <input
          type="${entity.mode == 1 ? "number" : "range"}"
          name="${entity.unique_id}"
          id="${entity.unique_id}"
          step="${step}"
          min="${min || Math.min(0, value as number)}"
          max="${max || Math.max(10, value as number)}"
          .value="${value}"
          @change="${(e: Event) => {
            const val = (<HTMLTextAreaElement>e.target)?.value;
            this.actioner?.restAction(entity, `${action}?${opt}=${val}`);
          }}"
        />
        <label>${max || 100}</label>
      </div>`;      
    } else {
      return html`    
      <esp-range-slider
        name="${entity.unique_id}"
        step="${step}"
        min="${min}"
        max="${max}"
        .value="${value}"
        @state="${(e: CustomEvent) => {
            const val = (<HTMLTextAreaElement>e.target)?.value;
            this.actioner?.restAction(entity, `${action}?${opt}=${e.detail.state}`);
          }}"
      ></esp-range-slider>`;
    }

  }

  private _textinput(
    entity: entityConfig,
    action: string,
    opt: string,
    value: string | number,
    min: number | undefined,
    max: number | undefined,
    pattern: string | undefined
  ) {
    return html`
      <input
        type="${entity.mode == 1 ? "password" : "text"}"
        name="${entity.unique_id}"
        id="${entity.unique_id}"
        minlength="${min || Math.min(0, value as number)}"
        maxlength="${max || Math.max(255, value as number)}"
        pattern="${pattern || ""}"
        .value="${value!}"
        @change="${(e: Event) => {
          const val = (<HTMLTextAreaElement>e.target)?.value;
          this.actioner?.restAction(
            entity,
            `${action}?${opt}=${encodeURIComponent(val)}`
          );
        }}"
      />
    `;
  }

  private _colorpicker(entity: entityConfig, action: string, value: any) {
    function u16tohex(d: number) {
      return Number(d).toString(16).padStart(2, "0");
    }
    function rgb_to_str(rgbhex: string) {
      const rgb = rgbhex
        .match(/[0-9a-f]{2}/gi)
        ?.map((x) => parseInt(x, 16)) || [0, 0, 0];
      return `r=${rgb[0]}&g=${rgb[1]}&b=${rgb[2]}`;
    }

    return html`<div class="colorpicker">
      <input
        type="color"
        name="${entity.unique_id}"
        id="${entity.unique_id}"
        value="#${u16tohex(value?.r)}${u16tohex(value?.g)}${u16tohex(value?.b)}"
        @change="${(e: Event) => {
          const val = (<HTMLTextAreaElement>e.target)?.value;
          this.actioner?.restAction(entity, `${action}?${rgb_to_str(val)}`);
        }}"
      />
    </div>`;
  }

  render_binary_sensor() {
    if (!this.entity) return;
    const isOn = this.entity.state == stateOn;
    return html`<iconify-icon
      class="binary_sensor_${this.entity.state?.toLowerCase()}"
      icon="mdi:checkbox-${isOn ? "marked-circle" : "blank-circle-outline"}"
      height="24px"
    ></iconify-icon>`;
  }

  render_date() {
    if (!this.entity) return;
    return html`
      ${this._datetime(
        this.entity,
        "date",
        "set",
        "value",
        this.entity.value,
      )}
    `;
  }

  render_time() {
    if (!this.entity) return;
    return html`
      ${this._datetime(
        this.entity,
        "time",
        "set",
        "value",
        this.entity.value,
      )}
    `;
  }

  render_datetime() {
    if (!this.entity) return;
    return html`
      ${this._datetime(
        this.entity,
        "datetime-local",
        "set",
        "value",
        this.entity.value,
      )}
    `;
  }

  render_switch() {
    if (!this.entity) return;
    if (this.entity.assumed_state)
      return html`${this._actionButton(this.entity, "❌", "turn_off")}
      ${this._actionButton(this.entity, "✔️", "turn_on")}`;
    else return this._switch(this.entity);
  }

  render_fan() {
    if (!this.entity) return;
    return [
      this.entity.speed,
      " ",
      this.entity.speed_level,
      this._switch(this.entity),
      this.entity.speed_count
        ? this._range(
            this.entity,
            `turn_${this.entity.state.toLowerCase()}`,
            "speed_level",
            this.entity.speed_level ? this.entity.speed_level : 0,
            0,
            this.entity.speed_count,
            1
          )
        : "",
    ];
  }

  render_light() {
    if (!this.entity) return;
    return [
      html`<div class="entity" style="
      width: 100%;">
        ${this._switch(this.entity)}
        ${this.entity.brightness
          ? this._range(
              this.entity,
              "turn_on",
              "brightness",
              this.entity.brightness,
              0,
              255,
              1
            )
          : ""}
        ${this.entity.color_mode === "rgb" || this.entity.color_mode === "rgbw"
          ? this._colorpicker(this.entity, "turn_on", this.entity?.color)
          : ""}
        ${this.entity.effects?.filter((v) => v != "None").length
          ? this._select(
              this.entity,
              "turn_on",
              "effect",
              this.entity.effects || [],
              this.entity.effect
            )
          : ""}
      </div> `,
    ];
  }

  render_lock() {
    if (!this.entity) return;
    return html`${this._actionButton(this.entity, "🔐", "lock")}
    ${this._actionButton(this.entity, "🔓", "unlock")}
    ${this._actionButton(this.entity, "↑", "open")} `;
  }

  render_cover() {
    if (!this.entity) return;
    return html`${this._actionButton(this.entity, "↑", "open")}
    ${this._actionButton(this.entity, "☐", "stop")}
    ${this._actionButton(this.entity, "↓", "close")}`;
  }

  render_button() {
    if (!this.entity) return;
    return html`${this._actionButton(this.entity, "PRESS", "press")}`;
  }

  render_select() {
    if (!this.entity) return;
    return this._select(
      this.entity,
      "set",
      "option",
      this.entity.option || [],
      this.entity.value
    );
  }

  render_number() {
    if (!this.entity) return;
    return html`
      ${this._range(
        this.entity,
        "set",
        "value",
        this.entity.value,
        this.entity.min_value,
        this.entity.max_value,
        this.entity.step
      )}
      ${this.entity.uom}
    `;
  }

  render_text() {
    if (!this.entity) return;
    return this._textinput(
      this.entity,
      "set",
      "value",
      this.entity.value,
      this.entity.min_length,
      this.entity.max_length,
      this.entity.pattern
    );
  }

  render_climate() {
    if (!this.entity) return;
    let target_temp_slider, target_temp_label, target_temp;
    let current_temp = html`<div class="climate-row" style="padding-bottom: 10px";>
                              <label>Current:&nbsp;${this.entity.current_temperature} °C</label>
                            </div>`;
    
    if (
      this.entity.target_temperature_low !== undefined &&
      this.entity.target_temperature_high !== undefined
    ) {
      target_temp = html`
        <div class="climate-row">
          <label>Target Low:&nbsp;</label>
          ${this._range(
            this.entity,
            "set",
            "target_temperature_low",
            this.entity.target_temperature_low,
            this.entity.min_temp,
            this.entity.max_temp,
            this.entity.step
          )}
        </div>
        <div class="climate-row">
          <label>Target High:&nbsp;</label>
          ${this._range(
            this.entity,
            "set",
            "target_temperature_high",
            this.entity.target_temperature_high,
            this.entity.min_temp,
            this.entity.max_temp,
            this.entity.step
          )}
        </div>`;
    } else {
      target_temp = html`
        <div class="climate-row">
          <label>Target:&nbsp;</label>
          ${this._range(
            this.entity,
            "set",
            "target_temperature",
            this.entity.target_temperature!!,
            this.entity.min_temp,
            this.entity.max_temp,
            this.entity.step
          )}
        </div>`;
    }
    let modes = html``;
    if ((this.entity.modes ? this.entity.modes.length : 0) > 0) {
      modes = html`
        <div class="climate-row">
          <label>Mode:&nbsp;</label>
          ${this._select(
            this.entity,
            "set",
            "mode",
            this.entity.modes || [],
            this.entity.mode || ""
          )}
        </div>`;
    }
    return html`
      <div class="climate-wrap">
        ${current_temp} ${target_temp} ${modes}
      </div>
    `;
  }

  render_valve() {
    if (!this.entity) return;
    return [
      html`<div
        class="entity"
        style="
      width: 100%;"
      >
        ${this._valve_switch(this.entity)}
        ${this.entity.position
          ? this._range(
              this.entity,
              "set",
              "position",
              this.entity.position,
              0.0,
              1.0,
              0.01
            )
          : ""}
      </div> `,
    ];
  }
}
