import type { Transform, BackgroundConfig } from '@/api/bindings';
import { hexToRgbaClearColor, hexToRgbaArray } from '../helpers/color';

// Import shaders as raw strings via Vite
import clipShaderCode from '../shaders/clip.wgsl?raw';
import bgGradientShaderCode from '../shaders/background.wgsl?raw';
import transitionShaderCode from '../shaders/transition.wgsl?raw';

const MSAA_SAMPLE_COUNT = 4;

export class WebGPURenderer {
  private canvas: HTMLCanvasElement | null = null;
  private device!: GPUDevice;
  private context: GPUCanvasContext | null = null;
  private pipeline!: GPURenderPipeline;
  private bgGradientPipeline!: GPURenderPipeline;
  private transitionPipeline!: GPURenderPipeline;
  private bgUniformBuffer!: GPUBuffer;
  private format: GPUTextureFormat = 'bgra8unorm';
  private disposed: boolean = false;
  private currentCommandEncoder: GPUCommandEncoder | null = null;
  private currentRenderPass: GPURenderPassEncoder | null = null;

  // Track rendering dimensions
  private width: number = 0;
  private height: number = 0;
  private offscreenTexture: GPUTexture | null = null;
  private multisampledTexture: GPUTexture | null = null;
  private sampler!: GPUSampler;

  constructor(
    target:
      HTMLCanvasElement | OffscreenCanvas | { width: number; height: number },
  ) {
    if (target && 'getContext' in target) {
      this.canvas = target as any;
      this.width = target.width;
      this.height = target.height;
    } else {
      this.width = target.width;
      this.height = target.height;
    }
  }

  public async initialize() {
    if (!navigator.gpu) {
      throw new Error('WebGPU is not supported on this browser.');
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No GPU found.');

    this.device = await adapter.requestDevice();
    this.format = navigator.gpu.getPreferredCanvasFormat();

    if (this.canvas) {
      this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;
      this.context.configure({
        device: this.device,
        format: this.format,
        alphaMode: 'premultiplied',
        usage:
          GPUTextureUsage.RENDER_ATTACHMENT |
          GPUTextureUsage.COPY_SRC |
          GPUTextureUsage.TEXTURE_BINDING,
      });
    } else {
      this.format = 'rgba8unorm';
      this.offscreenTexture = this.device.createTexture({
        size: [this.width, this.height],
        format: this.format,
        usage:
          GPUTextureUsage.RENDER_ATTACHMENT |
          GPUTextureUsage.COPY_SRC |
          GPUTextureUsage.TEXTURE_BINDING,
      });
    }

    this.multisampledTexture = this.device.createTexture({
      size: [this.width, this.height],
      sampleCount: MSAA_SAMPLE_COUNT,
      format: this.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    this.sampler = this.device.createSampler({
      minFilter: 'linear',
      magFilter: 'linear',
    });

    this.bgUniformBuffer = this.device.createBuffer({
      size: 272,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.setupPipeline();
  }

  public beginFrame(background?: BackgroundConfig | null) {
    if (
      this.disposed ||
      !this.device ||
      (!this.context && !this.offscreenTexture)
    )
      return;

    if (this.canvas) {
      const currentWidth = this.canvas.width;
      const currentHeight = this.canvas.height;

      if (currentWidth !== this.width || currentHeight !== this.height) {
        this.width = currentWidth;
        this.height = currentHeight;

        this.context!.configure({
          device: this.device,
          format: this.format,
          alphaMode: 'premultiplied',
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
        });

        if (this.multisampledTexture) {
          this.multisampledTexture.destroy();
        }
        this.multisampledTexture = this.device.createTexture({
          size: [this.width, this.height],
          sampleCount: MSAA_SAMPLE_COUNT,
          format: this.format,
          usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
      }
    }

    this.currentCommandEncoder = this.device.createCommandEncoder();

    let clearColor = { r: 0.0, g: 0.0, b: 0.0, a: 1.0 };
    let bgType = 0;

    if (background && background.source) {
      const source = background.source;
      if (source.type === 'solid') {
        clearColor = hexToRgbaClearColor(source.params.color_hex);
      } else if (source.type === 'gradient') {
        const gType = source.params.gradient_type;
        bgType = gType === 'linear' ? 1 : gType === 'radial' ? 2 : 3;
      }
    }

    const resolveTargetView = this.offscreenTexture
      ? this.offscreenTexture.createView()
      : this.context!.getCurrentTexture().createView();

    const msaaView = this.multisampledTexture!.createView();

    this.currentRenderPass = this.currentCommandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: msaaView,
          resolveTarget: resolveTargetView,
          clearValue: clearColor,
          loadOp: 'clear',
          storeOp: 'discard',
        },
      ],
    });

    if (bgType > 0 && background) {
      const source = background.source;
      const numColors =
        source.type === 'gradient' ? source.params.colors?.length || 0 : 0;
      const colors =
        source.type === 'gradient' ? source.params.colors || [] : [];
      const angleDegrees =
        source.type === 'gradient' ? (source.params.angle_degrees ?? 0) : 0;
      const blurValue = background.blur_value ?? 0;

      const bufferData = new ArrayBuffer(272);
      const view = new DataView(bufferData);
      view.setUint32(0, bgType, true);
      view.setUint32(4, numColors, true);
      view.setFloat32(8, angleDegrees, true);
      view.setFloat32(12, blurValue, true);

      for (let i = 0; i < 16; i++) {
        const colorHex = colors[i];
        const colorRgba = colorHex
          ? hexToRgbaArray(colorHex)
          : [0.0, 0.0, 0.0, 1.0];
        view.setFloat32(16 + i * 16 + 0, colorRgba[0], true);
        view.setFloat32(16 + i * 16 + 4, colorRgba[1], true);
        view.setFloat32(16 + i * 16 + 8, colorRgba[2], true);
        view.setFloat32(16 + i * 16 + 12, colorRgba[3], true);
      }

      this.device.queue.writeBuffer(this.bgUniformBuffer, 0, bufferData);

      if (bgType >= 1 && bgType <= 3) {
        const bindGroup = this.device.createBindGroup({
          layout: this.bgGradientPipeline.getBindGroupLayout(0),
          entries: [{ binding: 0, resource: { buffer: this.bgUniformBuffer } }],
        });

        this.currentRenderPass.setPipeline(this.bgGradientPipeline);
        this.currentRenderPass.setBindGroup(0, bindGroup);
        this.currentRenderPass.draw(6);
      }
    }

    this.currentRenderPass.setPipeline(this.pipeline);
  }

  public drawClip(frame: VideoFrame, transform: Transform | null) {
    if (!this.currentRenderPass || !this.device) {
      return;
    }

    const externalTexture = this.device.importExternalTexture({
      source: frame,
    });

    // Extract dynamic transform options from evaluated state
    const t: any = transform || {};
    const xVal = typeof t.x === 'number' ? t.x : 0.0;
    const yVal = typeof t.y === 'number' ? t.y : 0.0;
    const scaleVal = typeof t.scale === 'number' ? t.scale : 1.0;
    const rotationVal = typeof t.rotation === 'number' ? t.rotation : 0.0;
    const anchorXVal = typeof t.anchor_x === 'number' ? t.anchor_x : 0.5;
    const anchorYVal = typeof t.anchor_y === 'number' ? t.anchor_y : 0.5;
    const opacityVal = typeof t.opacity === 'number' ? t.opacity : 1.0;

    const brightVal = typeof t.brightness === 'number' ? t.brightness : 1.0;
    const contrastVal = typeof t.contrast === 'number' ? t.contrast : 1.0;
    const satVal = typeof t.saturation === 'number' ? t.saturation : 1.0;
    const vigVal = typeof t.vignette === 'number' ? t.vignette : 0.0;

    // Prepare Uniform Data (64 bytes)
    const uniformData = new Float32Array([
      this.width, // canvasResolution.x
      this.height, // canvasResolution.y
      frame.displayWidth, // frameResolution.x
      frame.displayHeight, // frameResolution.y
      xVal, // position.x
      yVal, // position.y
      anchorXVal, // anchor.x
      anchorYVal, // anchor.y
      scaleVal, // scale
      rotationVal, // rotation
      opacityVal, // opacity
      brightVal, // brightness
      contrastVal, // contrast
      satVal, // saturation
      vigVal, // vignette
      0, // Padding
    ]);

    const uniformBuffer = this.device.createBuffer({
      size: uniformData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    const bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: externalTexture },
        { binding: 2, resource: { buffer: uniformBuffer } },
      ],
    });

    this.currentRenderPass.setPipeline(this.pipeline);
    this.currentRenderPass.setBindGroup(0, bindGroup);
    this.currentRenderPass.draw(6);
  }

  public drawTransition(
    frameA: VideoFrame,
    frameB: VideoFrame,
    type: string,
    progress: number,
    config?: any,
  ) {
    if (!this.currentRenderPass || !this.device) return;

    const textureA = this.device.importExternalTexture({ source: frameA });
    const textureB = this.device.importExternalTexture({ source: frameB });

    // Map Transition string to shader enum ID
    let typeId = 1; // default crossfade (fade)
    let dirX = 1.0;
    let dirY = 0.0;

    const typeLower = (type || 'fade').toLowerCase();
    if (typeLower === 'fade') {
      typeId = 1;
    } else if (typeLower === 'slide') {
      typeId = 2;
      const angle = ((config?.angle_degrees ?? 0) * Math.PI) / 180.0;
      dirX = Math.cos(angle);
      dirY = Math.sin(angle);
    } else if (typeLower === 'wipe') {
      typeId = 3;
    } else if (typeLower === 'zoom') {
      typeId = 4;
    } else if (typeLower === 'spin') {
      typeId = 5;
    } else if (typeLower === 'glitch') {
      typeId = 6;
    }

    // 32-byte Uniform block
    const uniformData = new Float32Array([
      this.width, // canvasResolution.x
      this.height, // canvasResolution.y
      progress, // progress
      typeId, // transitionType (uint)
      dirX, // direction.x
      dirY, // direction.y
      0, // padding
      0, // padding
    ]);

    const uniformBuffer = this.device.createBuffer({
      size: uniformData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    const bindGroup = this.device.createBindGroup({
      layout: this.transitionPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: textureA },
        { binding: 2, resource: textureB },
        { binding: 3, resource: { buffer: uniformBuffer } },
      ],
    });

    this.currentRenderPass.setPipeline(this.transitionPipeline);
    this.currentRenderPass.setBindGroup(0, bindGroup);
    this.currentRenderPass.draw(6);
  }

  public setupPipeline() {
    // 1. Clip render pipeline (imported from clip.wgsl)
    const clipModule = this.device.createShaderModule({ code: clipShaderCode });
    this.pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: clipModule,
        entryPoint: 'vs_main',
      },
      fragment: {
        module: clipModule,
        entryPoint: 'fs_main',
        targets: [
          {
            format: this.format,
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
        ],
      },
      primitive: { topology: 'triangle-list' },
      multisample: {
        count: MSAA_SAMPLE_COUNT,
      },
    });

    // 2. Background Gradient Pipeline setup (imported from background.wgsl)
    const bgGradientModule = this.device.createShaderModule({
      code: bgGradientShaderCode,
    });
    this.bgGradientPipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: bgGradientModule,
        entryPoint: 'vs_bg',
      },
      fragment: {
        module: bgGradientModule,
        entryPoint: 'fs_gradient',
        targets: [{ format: this.format }],
      },
      primitive: { topology: 'triangle-list' },
      multisample: {
        count: MSAA_SAMPLE_COUNT,
      },
    });

    // 3. Transition Pipeline setup (imported from transition.wgsl)
    const transitionModule = this.device.createShaderModule({
      code: transitionShaderCode,
    });
    this.transitionPipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: transitionModule,
        entryPoint: 'vs_transition',
      },
      fragment: {
        module: transitionModule,
        entryPoint: 'fs_transition',
        targets: [
          {
            format: this.format,
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
        ],
      },
      primitive: { topology: 'triangle-list' },
      multisample: {
        count: MSAA_SAMPLE_COUNT,
      },
    });
  }

  public endFrame() {
    if (!this.currentCommandEncoder || !this.currentRenderPass) return;

    this.currentRenderPass.end();
    this.device.queue.submit([this.currentCommandEncoder.finish()]);

    this.currentCommandEncoder = null;
    this.currentRenderPass = null;
  }

  public dispose() {
    this.disposed = true;
    if (this.multisampledTexture) {
      this.multisampledTexture.destroy();
      this.multisampledTexture = null;
    }
    if (this.offscreenTexture) {
      this.offscreenTexture.destroy();
      this.offscreenTexture = null;
    }
  }
}
