import { html, css, LitElement, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import cssReset from "./css/reset";
import cssButton from "./css/button";

interface entityConfig {
  unique_id: string;
  domain: string;
  id: string;
  state: string;
  detail: string;
  value: string;
  name: string;
  when: string;
  icon?: string;
  option?: string[];
  assumed_state?: boolean;
  brightness?: number;
  target_temperature?: number;
  target_temperature_low?: number;
  target_temperature_high?: number;
  min_temp?: number;
  max_temp?: number;
  min_value?: number;
  max_value?: number;
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
  position?: number;
}

export function getBasePath() {
  let str = window.location.pathname;
  return str.endsWith("/") ? str.slice(0, -1) : str;
}

let basePath = getBasePath();

interface RestAction {
  restAction(entity?: entityConfig, action?: string): void;
}

@customElement("esp-entity-table")
export class EntityTable extends LitElement implements RestAction {
  @state() entities: entityConfig[] = [];
  @state() has_controls: boolean = false;

  private _actionRenderer = new ActionRenderer();

  connectedCallback() {
    super.connectedCallback();
    window.source?.addEventListener("state", (e: Event) => {
      const messageEvent = e as MessageEvent;
      const data = JSON.parse(messageEvent.data);
      let idx = this.entities.findIndex((x) => x.unique_id === data.id);
      if (idx === -1 && data.id) {
        // Dynamically add discovered..
        let parts = data.id.split("-");
        let entity = {
          ...data,
          domain: parts[0],
          unique_id: data.id,
          id: parts.slice(1).join("-"),
        } as entityConfig;
        entity.has_action = this.hasAction(entity);
        if (entity.has_action) {
          this.has_controls = true;
        }
        this.entities.push(entity);
        this.entities.sort((a, b) => (a.name < b.name ? -1 : 1));
        this.requestUpdate();
      } else {
        delete data.id;
        delete data.domain;
        delete data.unique_id;
        Object.assign(this.entities[idx], data);
        this.requestUpdate();
      }
    });
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
    fetch(`${basePath}/${entity.domain}/${entity.id}/${action}`, {
      method: "POST",
      headers:{
        'Content-Type': 'application/x-www-form-urlencoded'
      },
    }).then((r) => {
      console.log(r);
    });
  }

  render() {
    return html`
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>State</th>
            ${this.has_controls ? html`<th>Actions</th>` : html``}
          </tr>
        </thead>
        <tbody>
          ${this.entities.map(
            (component) => html`
              <tr>
                <td>${component.name}</td>
                <td>${component.state}</td>
                ${this.has_controls
                  ? html`<td>
                      ${component.has_action ? this.control(component) : html``}
                    </td>`
                  : html``}
              </tr>
            `
          )}
        </tbody>
      </table>
    `;
  }

  static get styles() {
    return [
      cssReset,
      cssButton,
      css`
        table {
          border-spacing: 0;
          border-collapse: collapse;
          width: 100%;
          border: 1px solid currentColor;
          background-color: var(--c-bg);
        }
        th {
          font-weight: 600;
          text-align: left;
        }
        th,
        td {
          padding: 0.25rem 0.5rem;
          border: 1px solid currentColor;
        }
        td:nth-child(2),
        th:nth-child(2) {
          text-align: center;
        }
        tr th,
        tr:nth-child(2n) {
          background-color: rgba(127, 127, 127, 0.3);
        }
        select {
          background-color: inherit;
          color: inherit;
          width: 100%;
          border-radius: 4px;
        }
        option {
          color: currentColor;
          background-color: var(--primary-color, currentColor);
        }
        input[type="range"], input[type="text"] {
          width: calc(100% - 8rem);
          min-width: 5rem;
          height: 0.75rem;
        }
        .range, .text {
          text-align: center;
        }
      `,
    ];
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
      class="rnd"
      @click=${() => this.actioner?.restAction(entity, a)}
    >
      ${label}
    </button>`;
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
      labelOn="Open"
      labelOff="Closed"
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
        let val = e.target?.value;
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
    min: number | undefined,
    max: number | undefined,
    step: number | undefined
  ) {
    return html`<div class="range">
      <label>${min || 0}</label>
      <input
        type="${entity.mode == 1 ? "number" : "range"}"
        name="${entity.unique_id}"
        id="${entity.unique_id}"
        step="${step || 1}"
        min="${min || Math.min(0, value as number)}"
        max="${max || Math.max(10, value as number)}"
        .value="${value!}"
        @change="${(e: Event) => {
          let val = e.target?.value;
          this.actioner?.restAction(entity, `${action}?${opt}=${val}`);
        }}"
      />
      <label>${max || 100}</label>
    </div>`;
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

  private _textinput(
    entity: entityConfig,
    action: string,
    opt: string,
    value: string | number,
    min: number | undefined,
    max: number | undefined,
    pattern: string | undefined
  ) {
    return html`<div class="text">
      <input
        type="${entity.mode == 1 ? "password" : "text"}"
        name="${entity.unique_id}"
        id="${entity.unique_id}"
        minlength="${min || Math.min(0, value as number)}"
        maxlength="${max || Math.max(255, value as number)}"
        pattern="${pattern || ''}"
        .value="${value!}"
        @change="${(e: Event) => {
          let val = e.target?.value;
          this.actioner?.restAction(entity, `${action}?${opt}=${encodeURIComponent(val)}`);
        }}"
      />
    </div>`;
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
      this._switch(this.entity),
      this.entity.brightness
        ? this._range(
            this.entity,
            "turn_on",
            "brightness",
            this.entity.brightness,
            0,
            255,
            1
          )
        : "",
      this.entity.effects?.filter((v) => v != "None").length
        ? this._select(
            this.entity,
            "turn_on",
            "effect",
            this.entity.effects || [],
            this.entity.effect
          )
        : "",
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
    return html`${this._actionButton(this.entity, "☐", "press ")}`;
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
    return this._range(
      this.entity,
      "set",
      "value",
      this.entity.value,
      this.entity.min_value,
      this.entity.max_value,
      this.entity.step
    );
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

  render_text() {
    if (!this.entity) return;
    return this._textinput(
      this.entity,
      "set",
      "value",
      this.entity.value,
      this.entity.min_length,
      this.entity.max_length,
      this.entity.pattern,
    );
  }

  render_climate() {
    if (!this.entity) return;
    let target_temp_slider, target_temp_label;
    if (
      this.entity.target_temperature_low !== undefined &&
      this.entity.target_temperature_high !== undefined
    ) {
      target_temp_label = html`${this.entity
        .target_temperature_low}&nbsp;..&nbsp;${this.entity
        .target_temperature_high}`;
      target_temp_slider = html`
        ${this._range(
          this.entity,
          "set",
          "target_temperature_low",
          this.entity.target_temperature_low,
          this.entity.min_temp,
          this.entity.max_temp,
          this.entity.step
        )}
        ${this._range(
          this.entity,
          "set",
          "target_temperature_high",
          this.entity.target_temperature_high,
          this.entity.min_temp,
          this.entity.max_temp,
          this.entity.step
        )}
      `;
    } else {
      target_temp_label = html`${this.entity.target_temperature}`;
      target_temp_slider = html`
        ${this._range(
          this.entity,
          "set",
          "target_temperature",
          this.entity.target_temperature!!,
          this.entity.min_temp,
          this.entity.max_temp,
          this.entity.step
        )}
      `;
    }
    let modes = html``;
    if ((this.entity.modes ? this.entity.modes.length : 0) > 0) {
      modes = html`Mode:<br />
        ${this._select(
          this.entity,
          "set",
          "mode",
          this.entity.modes || [],
          this.entity.mode || ""
        )}`;
    }
    return html`
      <label
        >Current:&nbsp;${this.entity.current_temperature},
        Target:&nbsp;${target_temp_label}</label
      >
      ${target_temp_slider} ${modes}
    `;
  }

  render_valve() {
    if (!this.entity) return;
    return [
      this._valve_switch(this.entity),
      this.entity.position
        ? this._range(
            this.entity,
            "set",
            "position",
            this.entity.position,
            0.0,
            1.0,
            0.01
          )
        : "",
    ];
  }
}
