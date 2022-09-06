const easeOutSine = (t, b, c, d) => {
  return c * Math.sin(t / d * (Math.PI / 2)) + b;
};

class PositionMouseInCanvas {
  constructor(scene, group, camera) {
    this.scene = scene;
    this.group = group;
    this.camera = camera;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(0, 0);

    this.initPlane();
    this.initTouch();
  }

  initPlane() {
    const planeGeo = new THREE.PlaneGeometry(1, 1, 32);
    const planeMat = new THREE.MeshBasicMaterial({
      color: "#000",
      side: THREE.DoubleSide
    });

    this.plane = new THREE.Mesh(planeGeo, planeMat);
    this.group.add(this.plane);

    this.canvas = document.querySelector("#chelet-han");
    this.cursor = document.querySelector(".cursor")
    
    this.boundCanvas = this.getBound(this.canvas)
    this.boundCursor = this.getBound(this.cursor)
    
    this.canvas.addEventListener("mousemove", e => this.onMouseMove(e));
    window.addEventListener("resize", () => this.onResize())
    //cursor.setAttribute("style", "top: "+e.pageY+"px; left: "+e.pageX+"px;")
  }
  
  getBound(el){
    const bound = el.getBoundingClientRect()
    return {w: bound.width, h: bound.height, left: bound.left, top: bound.top}
  }
  
  onResize(){
    this.boundCanvas = this.getBound(this.canvas)
    this.boundCursor = this.getBound(this.cursor)
  }

  initTouch() {
    if (!this.touch) this.touch = new TouchTexture();

    const uniforms = this.group.children[0].material.uniforms;
    uniforms.uTouch.value = this.touch.texture;
  }

  onMouseMove(e) {
    const t = e.touches ? e.touches[0] : e;
    const touch = { x: t.clientX, y: t.clientY };

    this.mouse.x =
      touch.x / this.boundCanvas.w * 2 - 1;
    this.mouse.y =
      -(touch.y / this.boundCanvas.h) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObjects([this.plane]);

    if (intersects.length > 0) {
      this.touch.addTouch(intersects[0].uv);
    }
    
    TweenMax.to(this.cursor, 0.5, {
      x: touch.x - this.boundCursor.w / 1,
      y: touch.y - this.boundCursor.h / 1
    })
  }

  update() {
    if(this.touch) this.touch.update()
    
  }
}

// Carga modelos 3D externos o texturas dependiendo de la opcion
const textureLoader = opt =>
  opt === "obj" ? new THREE.OBJLoader() : new THREE.TextureLoader();

class WebGL {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.camera = new THREE.PerspectiveCamera(
      45,
      innerWidth / innerHeight,
      0.1,
      1000
    );
    this.scene = new THREE.Scene();
    this.group = new THREE.Group();
    this.clock = new THREE.Clock();

    //this.helper = new Helper(this.scene);
    this.loader = textureLoader();

    this.update = this.update.bind(this);
  }

  // Coloca el objeto renderer dentro del DOM
  // Instaciamos la clase OrbitControls para mover la camara
  // Agrega la camara y el objeto group dentro de la escena
  init() {
    const _contentCanvas = document.querySelector("#content-canvas");

    this.renderer.domElement.id = "chelet-han";

    this.renderer.setPixelRatio(devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene.add(this.camera);
    this.scene.add(this.group);

    this.camera.position.set(0, 0, 1);
    this.camera.lookAt(this.scene.position);

    _contentCanvas.appendChild(this.renderer.domElement);

    this.initFn();
  }

  // Inicia todos los metodos que serviran para crear nuestro espacio y objetos
  initFn() {
    this.loader.load(
      "https://i.ibb.co/rv0mjML/sample-11.png",
      texture => {
        this.createMesh(texture);
        this.show();

        this.positionMouse = new PositionMouseInCanvas(
          this.scene,
          this.group,
          this.camera
        );

        this.update();

        window.addEventListener("resize", this.onResize);
      }
    );
  }

  // Crea el objeto (geometria, material y malla) para luego agregarlo al escenario
  createMesh(texture) {
    this.width = texture.image.width;
    this.height = texture.image.height;

    this.uniforms = {
      uTime: { value: 0 },
      uRandom: { value: 1.0 },
      uDepth: { value: 2.0 },
      uSize: { value: 0.0 },
      uTextureSize: { value: new THREE.Vector2(this.width, this.height) },
      uTexture: { value: texture },
      uMouse: { value: new THREE.Vector3() },
      uTouch: { value: null }
    };

    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.format = THREE.RGBFormat;

    this.numPoints = this.width * this.height;
    const threshold = 34;
    const [numVisible, originalColors] = this.discard(texture, threshold);

    const _particlesMat = new THREE.RawShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: vertexShader.textContent,
      fragmentShader: fragmentShader.textContent,
      depthTest: false,
      transparent: true,
      side: THREE.DoubleSide
    });

    const bufferGeometry = new THREE.InstancedBufferGeometry();
    const planeGeo = new THREE.PlaneBufferGeometry()
    
    bufferGeometry.copy(planeGeo)

    const indices = new Uint16Array(numVisible);
    const offsets = new Float32Array(numVisible * 3);
    const angles = new Float32Array(numVisible);

    for (let i = 0, j = 0; i < this.numPoints; i++) {
      if (originalColors[i * 4] <= threshold) continue;

      offsets[j * 3 + 0] = i % this.width;
      offsets[j * 3 + 1] = Math.floor(i / this.width);

      indices[j] = i;

      angles[j] = Math.random() * Math.PI;

      j++;
    }

    bufferGeometry.addAttribute(
      "pindex",
      new THREE.InstancedBufferAttribute(indices, 1, false)
    );
    bufferGeometry.addAttribute(
      "offset",
      new THREE.InstancedBufferAttribute(offsets, 3, false)
    );
    bufferGeometry.addAttribute(
      "angle",
      new THREE.InstancedBufferAttribute(angles, 1, false)
    );

    this.particlesMesh = new THREE.Mesh(bufferGeometry, _particlesMat);

    this.particlesMesh.position.z -= 270;

    this.group.add(this.particlesMesh);
  }

  discard(texture, threshold) {
    let numVisible = 0;
    let originalColors = null;

    const img = texture.image;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = this.width;
    canvas.height = this.height;
    ctx.scale(1, -1); // flip y
    ctx.drawImage(img, 0, 0, this.width, this.height * -1);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    originalColors = Float32Array.from(imgData.data);

    for (var i = 0; i < this.numPoints; i++) {
      if (originalColors[i * 4] > threshold) numVisible++;
    }

    return [numVisible, originalColors];
  }

  // Actualiza cualquier cambio, para luego representarlo en el canvas
  update() {
    this.renderer.setAnimationLoop(() => {
      const time = this.clock.getElapsedTime() * 0.5;

      //this.particlesMesh.material.uniforms.uTime.value = time;

      if (this.resizeRendererToDisplaySize(this.renderer)) {
        const canvas = this.renderer.domElement;
        this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
        this.camera.updateProjectionMatrix();
      }
      
      this.positionMouse.update()

      this.render();
    });

    requestAnimationFrame(this.update);
  }

  show(time = 1.0) {
    TweenLite.fromTo(
      this.particlesMesh.material.uniforms.uSize,
      time,
      { value: 0.5 },
      { value: 1.5 }
    );
    TweenLite.to(this.particlesMesh.material.uniforms.uRandom, time, {
      value: 2.0
    });
    TweenLite.fromTo(
      this.particlesMesh.material.uniforms.uDepth,
      time * 1.5,
      { value: 40.0 },
      { value: 4.0 }
    );
  }

  // Rescala el canvas y escenario
  resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
      renderer.setSize(width, height, false);
    }
    return needResize;
  }

  // Renderiza nuestro escenario
  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

class TouchTexture {
  constructor(parent) {
    this.parent = parent;
    this.size = 64;
    this.maxAge = 120;
    this.radius = 0.15;
    this.trail = [];

    this.initTexture();
  }

  initTexture() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    
    this.ctx = this.canvas.getContext("2d");
    this.ctx.fillStyle = "white";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.texture = new THREE.Texture(this.canvas);

    this.canvas.id = "touchTexture";
  }

  update(delta) {
    this.clear();
    // age points
    this.trail.forEach((point, i) => {
      point.age++;
      // remove old
      if (point.age > this.maxAge) {
        this.trail.splice(i, 1);
      }
    });

    this.trail.forEach((point, i) => {
      this.drawTouch(point);
    });

    this.texture.needsUpdate = true;
  }

  clear() {
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  addTouch(point) {
    let force = 0;
    const last = this.trail[this.trail.length - 1];

    if (last) {
      const dx = last.x - point.x;
      const dy = last.y - point.y;
      const dd = dx * dx + dy * dy;
      force = Math.min(dd * 10000, 1);
    }
    this.trail.push({ x: point.x, y: point.y, age: 0, force });
  }

  drawTouch(point) {
    const pos = {
      x: point.x * this.size,
      y: (1 - point.y) * this.size
    };

    let intensity = 1;
    if (point.age < this.maxAge * 0.3) {
      intensity = easeOutSine(point.age / (this.maxAge * 0.3), 0, 1, 1);
    } else {
      intensity = easeOutSine(
        1 - (point.age - this.maxAge * 0.3) / (this.maxAge * 0.7),
        0,
        1,
        1
      );
    }

    intensity *= point.force;

    const radius = this.size * this.radius * intensity;

    const grd = this.ctx.createRadialGradient(
      pos.x,
      pos.y,
      radius * 0.25,
      pos.x,
      pos.y,
      radius
    );
    grd.addColorStop(0, `rgba(255, 255, 255, 0.2)`);
    grd.addColorStop(1, "rgba(0, 0, 0, 0.0)");

    this.ctx.beginPath();
    this.ctx.fillStyle = grd;
    this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }
}

const webgl = new WebGL();
webgl.init();