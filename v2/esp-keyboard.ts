import { LitElement, html, css } from "lit";
import { customElement, property, queryAll, state } from "lit/decorators.js";

import "./esp-keyboard-key";

@customElement("esp-keyboard")
export default class EspKeyboard extends LitElement {
  @queryAll("[modifier=true]")
  _modifiers;
  @property()
  keyboard_id = ''
  @state()
  _socket : WebSocket = null
  @state()
  _opened = false

  connectedCallback() {
    super.connectedCallback();

    this.addEventListener("keyclick", (evt) => {
      this.onKeyClick(
        evt.detail.key,
        evt.detail.code,
        evt.detail.isModifier
      );
    });

    this.addEventListener("keyrelease", (evt) => {
      this.emitKeyEvent("keyup", evt.detail.key, evt.detail.code);
    });

    window.addEventListener("update-kbd-id", (evt) => {
      this._socket?.close();
      this._socket = null
      this.keyboard_id = evt.detail

      if(this.keyboard_id != '') {
        //TODO add ping ??
        let url = window.location.host + window.location.pathname;
        url += url.endsWith("/") ? "" : "/";
        this._socket = new WebSocket('ws://' + url + 'keyboard/' + this.keyboard_id );
        this._socket.addEventListener('close', (event) => {
          this.keyboard_id = ''
          this._opened = false;
          this._socket = null
          this.dispatchEvent(new CustomEvent('kbd-closed', {
            composed: true,
            bubbles: true
          }));
        });

        this._socket.addEventListener('error', (event) => {
          this._socket.close()
        });

        this._socket.addEventListener('open', (event) => {
          this._opened = true;
        });
      }
    });
    window.addEventListener("keyup", (evt) => {
      this.sendKey(evt);
    });
    window.addEventListener("keydown", (evt) => {
      this.sendKey(evt);
    });
  }

  sendKey(evt: KeyboardEvent) {
    if(this._opened) {
      evt.preventDefault();
      this._socket.send(evt.type.substring(3)[0] + evt.code);
    }
  }

  onKeyClick(key: string, code: string, isModifier : boolean) {
    // Make uppercase when shift is active – but only if no other modifier
    // is pressed at the same time.
    if (
      ["ShiftLeft", "ShiftRight"].some((m) =>
        this.isModifierKeyPressed(m)
      ) &&
      [
        "MetaLeft",
        "MetaRight",
        "AltLeft",
        "AltRight",
        "ControlLeft",
        "ControlRight",
      ].every((m) => !this.isModifierKeyPressed(m))
    ) {
      key = this.getShiftedKeyValue(key);
    }

    this.emitKeyEvent("keydown", key, code);

    if (!isModifier) {
      this.emitKeyEvent("keyup", key, code);

      // Remove pressed state from all modifier keys if non-modifier key
      // was pressed.
      this.clearPressedKeys();
    }
  }


  isModifierKeyPressed(keyCode: string) {
    let result = false;
    this._modifiers.forEach((modifier) => {
      if (modifier.pressed && modifier.code == keyCode) {
        result = true;
        return;
      }
    });
    return result;
  }

  emitKeyEvent(eventType: string, key: string, code: string) {
    this.dispatchEvent(
      new KeyboardEvent(eventType, {
        bubbles: true,
        composed: true,
        key: key,
        code: code,
        metaKey:
          this.isModifierKeyPressed("MetaLeft") ||
          this.isModifierKeyPressed("MetaRight"),
        ctrlKey:
          this.isModifierKeyPressed("ControlLeft") ||
          this.isModifierKeyPressed("ControlRight"),
        shiftKey:
          this.isModifierKeyPressed("ShiftLeft") ||
          this.isModifierKeyPressed("ShiftRight"),
        altKey:
          this.isModifierKeyPressed("AltLeft") ||
          this.isModifierKeyPressed("AltRight"),
      })
    );
  }

  clearPressedKeys() {
      this._modifiers.forEach((modifier) => {
        if (modifier.pressed) {
          modifier.pressed = false;
          this.emitKeyEvent("keyup", modifier.key, modifier.code);
        }
      });
  }

  getShiftedKeyValue(key) {
    if (/^[a-z]$/.test(key)) {
      return key.toUpperCase();
    }
    const shiftMappings = {
      "`": "~",
      "1": "!",
      "2": "@",
      "3": "#",
      "4": "$",
      "5": "%",
      "6": "^",
      "7": "&",
      "8": "*",
      "9": "(",
      "0": ")",
      "-": "_",
      "=": "+",
      "[": "{",
      "]": "}",
      "\\": "|",
      ";": ":",
      "'": '"',
      ",": "<",
      ".": ">",
      "/": "?",
    };
    if (key in shiftMappings) {
      return shiftMappings[key];
    }
    // This key is the same regardless of whether the shift key is
    // pressed.
    return key;
  }

  render() {
    if(this['keyboard_id'] == '') {
      return html``
    }
    return html`
    <div class="keyboard">
    <div id="keyboard-block-left" class="keyboard-block">
      <div class="keyboard-row keyboard-row-bump">
        <keyboard-key class="accented" code="Escape">Esc</keyboard-key>
        <keyboard-key class="hidden"></keyboard-key>
        <keyboard-key code="F1">F1</keyboard-key>
        <keyboard-key code="F2">F2</keyboard-key>
        <keyboard-key code="F3">F3</keyboard-key>
        <keyboard-key code="F4">F4</keyboard-key>
        <keyboard-key class="hidden key-collapse-half"></keyboard-key>

        <keyboard-key code="F5">F5</keyboard-key>
        <keyboard-key code="F6">F6</keyboard-key>
        <keyboard-key code="F7">F7</keyboard-key>
        <keyboard-key code="F8">F8</keyboard-key>
        <keyboard-key class="hidden key-collapse-half"></keyboard-key>

        <keyboard-key code="F9">F9</keyboard-key>
        <keyboard-key code="F10">F10</keyboard-key>
        <keyboard-key code="F11">F11</keyboard-key>
        <keyboard-key code="F12">F12</keyboard-key>
      </div>
      <!-- end keyboard-row -->

      <div class="keyboard-row">
        <keyboard-key code="Backquote">
          <slot>~</slot>
          <span slot="bottom">\`</span>
        </keyboard-key>
        <keyboard-key code="Digit1">
          <slot>!</slot>
          <span slot="bottom">1</span>
        </keyboard-key>
        <keyboard-key code="Digit2">
          <slot>@</slot>
          <span slot="bottom">2</span>
        </keyboard-key>
        <keyboard-key code="Digit3">
          <slot>#</slot>
          <span slot="bottom">3</span>
        </keyboard-key>
        <keyboard-key code="Digit4">
          <slot>$</slot>
          <span slot="bottom">4</span>
        </keyboard-key>
        <keyboard-key code="Digit5">
          <slot>%</slot>
          <span slot="bottom">5</span>
        </keyboard-key>
        <keyboard-key code="Digit6">
          <slot>^</slot>
          <span slot="bottom">6</span>
        </keyboard-key>
        <keyboard-key code="Digit7">
          <slot>&</slot>
          <span slot="bottom">7</span>
        </keyboard-key>
        <keyboard-key code="Digit8">
          <slot>*</slot>
          <span slot="bottom">8</span>
        </keyboard-key>
        <keyboard-key code="Digit9">
          <slot>(</slot>
          <span slot="bottom">9</span>
        </keyboard-key>
        <keyboard-key code="Digit0">
          <slot>)</slot>
          <span slot="bottom">0</span>
        </keyboard-key>
        <keyboard-key code="Minus">
          <slot>_</slot>
          <span slot="bottom">-</span>
        </keyboard-key>
        <keyboard-key code="Equal">
          <slot>+</slot>
          <span slot="bottom">=</span>
        </keyboard-key>

        <keyboard-key code="Backspace" class="key-extend-full accented"
          >Backspace</keyboard-key
        >
      </div>
      <!-- end keyboard-row -->

      <div class="keyboard-row">
        <keyboard-key code="Tab" class="key-extend-full accented"
          >Tab</keyboard-key
        >
        <keyboard-key code="KeyQ">Q</keyboard-key>
        <keyboard-key code="KeyW">W</keyboard-key>
        <keyboard-key code="KeyE">E</keyboard-key>
        <keyboard-key code="KeyR">R</keyboard-key>
        <keyboard-key code="KeyT">T</keyboard-key>
        <keyboard-key code="KeyY">Y</keyboard-key>
        <keyboard-key code="KeyU">U</keyboard-key>
        <keyboard-key code="KeyI">I</keyboard-key>
        <keyboard-key code="KeyO">O</keyboard-key>
        <keyboard-key code="KeyP">P</keyboard-key>
        <keyboard-key code="BracketLeft">
          <slot>{</slot>
          <span slot="bottom">[</span>
        </keyboard-key>
        <keyboard-key code="BracketRight">
          <slot>}</slot>
          <span slot="bottom">]</span>
        </keyboard-key>
        <keyboard-key code="Backslash">
          <slot>|</slot>
          <span slot="bottom">\</span>
        </keyboard-key>
      </div>
      <!-- end keyboard-row -->
      <div class="keyboard-row">
        <keyboard-key code="CapsLock" class="key-extend-full accented"
          >Caps Lock</keyboard-key
        >
        <keyboard-key code="KeyA">A</keyboard-key>
        <keyboard-key code="KeyS">S</keyboard-key>
        <keyboard-key code="KeyD">D</keyboard-key>
        <keyboard-key code="KeyF">F</keyboard-key>
        <keyboard-key code="KeyG">G</keyboard-key>
        <keyboard-key code="KeyH">H</keyboard-key>
        <keyboard-key code="KeyJ">J</keyboard-key>
        <keyboard-key code="KeyK">K</keyboard-key>
        <keyboard-key code="KeyL">L</keyboard-key>
        <keyboard-key code="Semicolon">
          <slot>:</slot>
          <span slot="bottom">;</span>
        </keyboard-key>
        <keyboard-key code="Quote">
          <slot>"</slot>
          <span slot="bottom">'</span>
        </keyboard-key>

        <keyboard-key code="Enter" class="key-extend-full accented"
          >Enter</keyboard-key
        >
      </div>
      <!-- end keyboard-row -->

      <div class="keyboard-row">
        <keyboard-key
          code="ShiftLeft"
          modifier="true"
          class="modifier key-extend-full-half accented"
          >Shift</keyboard-key
        >

        <keyboard-key code="KeyZ">Z</keyboard-key>
        <keyboard-key code="KeyX">X</keyboard-key>
        <keyboard-key code="KeyC">C</keyboard-key>
        <keyboard-key code="KeyV">V</keyboard-key>
        <keyboard-key code="KeyB">B</keyboard-key>
        <keyboard-key code="KeyN">N</keyboard-key>
        <keyboard-key code="KeyM">M</keyboard-key>
        <keyboard-key code="Comma">
          <slot></slot>
          <span slot="bottom">,</span>
        </keyboard-key>
        <keyboard-key code="Period">
          <slot>></slot>
          <span slot="bottom">.</span>
        </keyboard-key>
        <keyboard-key code="Slash">
          <slot>?</slot>
          <span slot="bottom">/</span>
        </keyboard-key>
        <keyboard-key
          code="ShiftRight"
          modifier="true"
          class="modifier key-extend-full-half accented"
          >Shift</keyboard-key
        >
      </div>
      <!-- end keyboard-row -->

      <div class="keyboard-row">
        <keyboard-key
          code="ControlLeft"
          modifier="true"
          class="modifier key-extend-full accented"
          >Control</keyboard-key
        >
        <keyboard-key
          code="MetaLeft"
          modifier="true"
          class="modifier key-extend-half accented"
          >Meta</keyboard-key
        >
        <keyboard-key code="AltLeft" modifier="true" class="modifier accented"
          >Alt</keyboard-key
        >
        <keyboard-key code="Space" class="key-space">Space</keyboard-key>
        <keyboard-key code="AltRight" modifier="true" class="modifier accented"
          >Alt</keyboard-key
        >
        <keyboard-key
          code="MetaRight"
          modifier="true"
          class="modifier key-extend-half accented"
          >Meta</keyboard-key
        >
        <keyboard-key
          code="ContextMenu"
          key="ContextMenu"
          class="key-extend-half accented"
          >Menu</keyboard-key
        >
        <keyboard-key
          code="ControlRight"
          modifier="true"
          class="modifier key-extend-full accented"
          >Control</keyboard-key
        >
      </div>
      <!-- end keyboard-row -->
    </div>
    <div id="keyboard-block-right" class="keyboard-block">
      <div class="keyboard-row keyboard-row-bump">
        <keyboard-key code="PrintScreen">Print</keyboard-key>
        <keyboard-key code="ScrollLock">Scroll Lock</keyboard-key>
        <keyboard-key code="Pause">Pause</keyboard-key>
      </div>
      <!-- end keyboard-row -->
      <div class="keyboard-row">
        <keyboard-key code="Insert">Insert</keyboard-key>
        <keyboard-key code="Home">Home</keyboard-key>
        <keyboard-key code="PageUp">Page Up</keyboard-key>
      </div>
      <!-- end keyboard-row -->
      <div class="keyboard-row">
        <keyboard-key code="Delete">Delete</keyboard-key>
        <keyboard-key code="End">End</keyboard-key>
        <keyboard-key code="PageDown">Page Down</keyboard-key>
      </div>
      <!-- end keyboard-row -->
      <div class="keyboard-row">
        <keyboard-key class="hidden"></keyboard-key>
      </div>
      <!-- end keyboard-row -->
      <div class="keyboard-row">
        <keyboard-key class="hidden"></keyboard-key>
        <keyboard-key use-code="true" code="ArrowUp">Up</keyboard-key>
        <keyboard-key class="hidden"></keyboard-key>
      </div>
      <!-- end keyboard-row -->
      <div class="keyboard-row">
        <keyboard-key use-code="true" code="ArrowLeft">Left</keyboard-key>
        <keyboard-key use-code="true" code="ArrowDown">Down</keyboard-key>
        <keyboard-key use-code="true" code="ArrowRight">Right</keyboard-key>
      </div>
      <!-- end keyboard-row -->
    </div>
  </div>
  `
  }

  static get styles() {
    return [
      css`
      .keyboard {
        width: 992px;
        min-width: 992px;
        background-color: #f7f7f7;
        margin: 1rem auto;
        padding: 14px;
        color: #333;
        border: 1px solid rgb(92, 92, 92);
      }
  
      .keyboard-block {
        display: inline-block;
      }
  
      #keyboard-block-left {
        margin-right: 14px;
        width: 780px;
      }
  
      #keyboard-block-right {
        margin-left: 14px;
        width: 156px;
      }
  
      .keyboard-row {
        width: 100%;
        float: left;
      }
  
      .keyboard-row-bump {
        padding-bottom: 28px;
      }
      `,
    ]
  }
}
