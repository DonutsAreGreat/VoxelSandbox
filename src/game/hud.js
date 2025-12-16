export class HUD {
  constructor(rootElement) {
    this.root = rootElement;
    this.root.innerHTML = '';
    this.crosshair = document.createElement('div');
    this.crosshair.className = 'crosshair';
    this.root.appendChild(this.crosshair);

    this.panel = document.createElement('div');
    this.panel.className = 'hud-panel';
    this.panel.innerHTML = `
      <div class="hud-title">Sandbox Tools</div>
      <div class="hud-row"><span class="label">Tool</span><span class="value" id="hud-tool">Pickaxe</span></div>
      <div class="hud-row"><span class="label">Material</span><span class="value" id="hud-mat">Stone</span></div>
      <div class="hud-row"><span class="label">Bombs</span><span class="value" id="hud-bombs">0</span></div>
      <div class="hud-row"><span class="label">Tip</span><span class="value" id="hud-tip">Click to dig</span></div>
    `;
    this.root.appendChild(this.panel);

    this.fps = document.createElement('div');
    this.fps.className = 'fps';
    this.fps.textContent = 'FPS: 0';
    this.root.appendChild(this.fps);

    this.toolValue = this.panel.querySelector('#hud-tool');
    this.matValue = this.panel.querySelector('#hud-mat');
    this.bombValue = this.panel.querySelector('#hud-bombs');
    this.tipValue = this.panel.querySelector('#hud-tip');
  }

  update(info) {
    if (info.toolName) this.toolValue.textContent = info.toolName;
    if (info.materialName) this.matValue.textContent = info.materialName;
    if (info.bombs !== undefined) this.bombValue.textContent = info.bombs.toString();
    if (info.fps !== undefined) this.fps.textContent = `FPS: ${info.fps.toFixed(0)}`;
    if (info.tip) this.tipValue.textContent = info.tip;
  }
}
