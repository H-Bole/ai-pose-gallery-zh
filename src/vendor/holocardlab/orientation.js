const difference = (value, origin) => ((value - origin + 180) % 360 + 360) % 360 - 180;
const lightPosition = degrees => {
  const deadzone = .35;
  const tilt = Math.sign(degrees) * Math.max(0, Math.abs(degrees) - deadzone);
  return Math.max(0, Math.min(1, .5 + tilt / (20 - deadzone) / 2));
};

export class OrientationInput {
  constructor({ onPose, onState, win = window }) {
    this.win = win;
    this.onPose = onPose;
    this.onState = onState;
    this.screen = win.screen?.orientation;
    this.listening = false;
    this.requesting = false;
    this.disposed = false;
    this.version = 0;
    this.frame = null;
    this.timer = null;
    this.latest = null;
    this.baseline = null;
    this.pendingPose = null;
    this.handleOrientation = event => this.receive(event);
    this.handleRotation = () => this.checkRotation();
    this.handleVisibility = () => {
      if (this.win.document.hidden) this.stop('页面已进入后台；请点击按钮重新开启倾斜感应。');
    };
  }

  get active() { return this.listening; }

  emit(status, message) { this.onState?.({ status, message }); }

  angle() {
    const angle = this.screen?.angle;
    return Number.isFinite(angle) ? angle : Number.isFinite(this.win.orientation) ? this.win.orientation : 0;
  }

  async start() {
    if (this.disposed) return false;
    if (this.listening) return true;
    if (this.requesting) return false;
    if (this.win.isSecureContext !== true) {
      this.emit('insecure', '倾斜感应需要安全连接，请通过 HTTPS 打开页面。');
      return false;
    }
    const Sensor = this.win.DeviceOrientationEvent;
    if (!Sensor) {
      this.emit('unsupported', '当前浏览器不支持设备方向感应，请使用触摸或光位滑杆。');
      return false;
    }
    if (this.win.document.hidden) {
      this.emit('paused', '页面在后台；请回到页面后点击按钮开启倾斜感应。');
      return false;
    }
    const version = ++this.version;
    this.requesting = true;
    this.win.document.addEventListener('visibilitychange', this.handleVisibility);
    try {
      if (typeof Sensor.requestPermission === 'function') {
        // Keep the permission call in the original click's activation, before any await.
        const permission = Sensor.requestPermission();
        this.emit('requesting', '请允许浏览器访问设备方向感应。');
        const result = await permission;
        if (version !== this.version) return false;
        if (result !== 'granted') {
          this.clear();
          this.emit('denied', '设备方向权限未获允许；请在浏览器设置中允许后重新点击开启。');
          return false;
        }
      }
      if (version !== this.version) return false;
      if (this.win.document.hidden) {
        this.stop('页面已进入后台；请点击按钮重新开启倾斜感应。');
        return false;
      }
      this.requesting = false;
      this.listening = true;
      this.screenAngle = this.angle();
      this.win.addEventListener('deviceorientation', this.handleOrientation);
      this.win.addEventListener('orientationchange', this.handleRotation);
      this.screen?.addEventListener('change', this.handleRotation);
      this.waitForData('等待设备方向数据；请保持自然握持姿势。');
      return true;
    } catch (error) {
      if (version !== this.version) return false;
      this.clear();
      this.emit(error?.name === 'NotAllowedError' ? 'denied' : 'error',
        error?.name === 'NotAllowedError'
          ? '无法取得设备方向权限；请直接点击开启按钮，并检查浏览器权限。'
          : '设备方向感应启动失败，请检查浏览器权限后重试。');
      return false;
    }
  }

  waitForData(message) {
    this.win.clearTimeout(this.timer);
    this.timer = this.win.setTimeout(() => {
      this.clear();
      this.emit('no-data', '未收到有效方向数据；请确认设备有传感器、权限已允许，并通过 HTTPS 连接。');
    }, 6000);
    this.emit('waiting', message);
  }

  checkRotation() {
    if (!this.listening) return;
    const angle = this.angle();
    if (difference(angle, this.screenAngle) === 0) return;
    this.screenAngle = angle;
    this.baseline = this.latest = null;
    this.cancelFrame();
    this.waitForData('屏幕方向已变化；等待新数据重新校准。');
  }

  receive({ beta, gamma }) {
    if (!this.listening || !Number.isFinite(beta) || !Number.isFinite(gamma)) return;
    this.checkRotation();
    this.latest = { beta, gamma };
    if (!this.baseline) {
      this.baseline = this.latest;
      this.win.clearTimeout(this.timer);
      this.timer = null;
      this.emit('active', '倾斜感应已开启；当前握持姿势为中心，可随时重新校准。');
    }
    const x = difference(gamma, this.baseline.gamma);
    const y = difference(beta, this.baseline.beta);
    const radians = this.screenAngle * Math.PI / 180;
    this.queuePose(lightPosition(x * Math.cos(radians) + y * Math.sin(radians)),
      lightPosition(y * Math.cos(radians) - x * Math.sin(radians)));
  }

  queuePose(x, y) {
    this.pendingPose = [x, y];
    if (this.frame !== null) return;
    this.frame = this.win.requestAnimationFrame(() => {
      this.frame = null;
      const pose = this.pendingPose;
      this.pendingPose = null;
      if (this.listening && pose) this.onPose(...pose);
    });
  }

  calibrate() {
    if (!this.listening || !this.latest) return false;
    this.baseline = this.latest;
    this.queuePose(.5, .5);
    this.emit('active', '已将当前握持姿势校准为中心。');
    return true;
  }

  cancelFrame() {
    if (this.frame !== null) this.win.cancelAnimationFrame(this.frame);
    this.frame = null;
    this.pendingPose = null;
  }

  clear() {
    this.listening = this.requesting = false;
    this.win.removeEventListener('deviceorientation', this.handleOrientation);
    this.win.removeEventListener('orientationchange', this.handleRotation);
    this.screen?.removeEventListener('change', this.handleRotation);
    this.win.document.removeEventListener('visibilitychange', this.handleVisibility);
    this.win.clearTimeout(this.timer);
    this.timer = null;
    this.cancelFrame();
    this.latest = this.baseline = null;
  }

  stop(reason) {
    ++this.version;
    this.clear();
    if (!this.disposed) this.emit(this.win.document.hidden ? 'paused' : 'stopped', reason || '倾斜感应已关闭。');
  }

  dispose() {
    if (this.disposed) return;
    ++this.version;
    this.clear();
    this.disposed = true;
    this.emit('disposed', '倾斜感应已释放。');
  }
}
