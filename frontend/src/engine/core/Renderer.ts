import type { Transform, BackgroundConfig } from '@/api/bindings';

const MSAA_SAMPLE_COUNT = 4;

function hexToRgbaClearColor(hex: string) {
  const rgba = hexToRgbaArray(hex);
  return { r: rgba[0], g: rgba[1], b: rgba[2], a: rgba[3] };
}

function hexToRgbaArray(hex: string): [number, number, number, number] {
  if (!hex) return [0, 0, 0, 1];
  let cleanHex = hex.replace(/^#/, '');

  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split('')
      .map((char) => char + char)
      .join('');
  }

  if (cleanHex.length !== 6 && cleanHex.length !== 8) {
    return [0, 0, 0, 1];
  }

  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  const a =
    cleanHex.length === 8 ? parseInt(cleanHex.substring(6, 8), 16) / 255 : 1;

  return [r, g, b, a];
}

export class WebGPURenderer {
  private canvas: HTMLCanvasElement | null = null;
  private device!: GPUDevice;
  private context: GPUCanvasContext | null = null;
  private pipeline!: GPURenderPipeline;
  private bgGradientPipeline!: GPURenderPipeline;
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
      | HTMLCanvasElement
      | OffscreenCanvas
      | { width: number; height: number },
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
        // COPY_SRC is useful if we ever want to read from preview canvas
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
      });
    } else {
      // Force RGBA format for offscreen exporting (standard format avoiding driver channels swap)
      this.format = 'rgba8unorm';
      // Initialize custom offscreen texture with COPY_SRC enabled for extraction
      this.offscreenTexture = this.device.createTexture({
        size: [this.width, this.height],
        format: this.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
      });
    }

    // Allocate multisampled texture for MSAA (4x MSAA)
    this.multisampledTexture = this.device.createTexture({
      size: [this.width, this.height],
      sampleCount: MSAA_SAMPLE_COUNT,
      format: this.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    // Create the reusable bilinear sampler
    this.sampler = this.device.createSampler({
      minFilter: 'linear',
      magFilter: 'linear',
    });

    // Reusable uniform buffer for background rendering parameters (272 bytes)
    this.bgUniformBuffer = this.device.createBuffer({
      size: 272,
      usage: 64 | 8, // GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
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

    // Dynamically resize preview canvas WebGPU context and MSAA texture if dimensions change
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

    // Determine clear value color from background configuration
    let clearColor = { r: 0.0, g: 0.0, b: 0.0, a: 1.0 };
    let bgType = 0; // 0 = solid/clear, 1 = linear, 2 = radial, 3 = conic

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
          storeOp: 'discard', // Discard multisampled texture after resolving to resolveTarget
        },
      ],
    });

    // If gradient background is active, render it onto canvas
    if (bgType > 0 && background) {
      const source = background.source;
      const numColors =
        source.type === 'gradient' ? source.params.colors?.length || 0 : 0;
      const colors =
        source.type === 'gradient' ? source.params.colors || [] : [];
      const angleDegrees =
        source.type === 'gradient' ? (source.params.angle_degrees ?? 0) : 0;
      const blurValue = background.blur_value ?? 0;

      // Prepare Uniform Buffer Data (272 bytes)
      const bufferData = new ArrayBuffer(272);
      const view = new DataView(bufferData);
      view.setUint32(0, bgType, true);
      view.setUint32(4, numColors, true);
      view.setFloat32(8, angleDegrees, true);
      view.setFloat32(12, blurValue, true);

      // Populate up to 16 colors
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
        // Gradient backgrounds (linear, radial, conic)
        const bindGroup = this.device.createBindGroup({
          layout: this.bgGradientPipeline.getBindGroupLayout(0),
          entries: [{ binding: 0, resource: { buffer: this.bgUniformBuffer } }],
        });

        this.currentRenderPass.setPipeline(this.bgGradientPipeline);
        this.currentRenderPass.setBindGroup(0, bindGroup);
        this.currentRenderPass.draw(6);
      }
    }

    // Set the clip render pipeline back to default for rendering clips
    this.currentRenderPass.setPipeline(this.pipeline);
  }

  public drawClip(frame: VideoFrame, transform: Transform | null) {
    if (!this.currentRenderPass || !this.device) {
      return;
    }

    // prepare the texture from the VideoFrame
    const externalTexture = this.device.importExternalTexture({
      source: frame,
    });

    // Prepare the Uniform Data (MUST match the Shader struct above)
    const uniformData = new Float32Array([
      this.width, // canvasResolution.x
      this.height, // canvasResolution.y
      frame.displayWidth, // frameResolution.x
      frame.displayHeight, // frameResolution.y
      transform?.x ?? 0, // position.x
      transform?.y ?? 0, // position.y
      transform?.scale ?? 1, // scale
      0, // Padding (for 16-byte alignment)
    ]);

    const uniformBuffer = this.device.createBuffer({
      size: uniformData.byteLength,
      usage: 64 | 8, // GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    // Create the Bind Group for this specific clip
    const bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: externalTexture },
        { binding: 2, resource: { buffer: uniformBuffer } },
      ],
    });

    // Record the draw command into the current pass
    this.currentRenderPass.setBindGroup(0, bindGroup);
    this.currentRenderPass.draw(6);
  }

  public setupPipeline() {
    // 1. Clip render pipeline
    const shaderCode = `
      struct Uniforms {
        canvasResolution: vec2<f32>,
        frameResolution: vec2<f32>,
        position: vec2<f32>,
        scale: f32,
      }

      struct VertexOutput {
        @builtin(position) Position : vec4<f32>,
        @location(0) uv : vec2<f32>,
      }

      @group(0) @binding(0) var mySampler: sampler;
      @group(0) @binding(1) var myTexture: texture_external;
      @group(0) @binding(2) var<uniform> uniforms: Uniforms;

      @vertex
      fn vs_main(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
          var pos = array<vec2<f32>, 6>(
              vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0,  1.0),
              vec2<f32>(-1.0,  1.0), vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0)
          );

          var uv_coords = array<vec2<f32>, 6>(
              vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 1.0), vec2<f32>(0.0, 0.0),
              vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0), vec2<f32>(1.0, 0.0)
          );

          var p = pos[VertexIndex];
          var out: VertexOutput;

          out.uv = uv_coords[VertexIndex];

          // Apply transformation: Scale then Translate
          p = p * uniforms.scale;
          
          // Convert pixel position to NDC (-1 to 1)
          let offset = vec2<f32>(
            (uniforms.position.x / uniforms.canvasResolution.x) * 2.0,
            -(uniforms.position.y / uniforms.canvasResolution.y) * 2.0
          );

          out.Position = vec4<f32>(p + offset, 0.0, 1.0);
          return out;
      }

      @fragment
      fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
          return textureSampleBaseClampToEdge(myTexture, mySampler, uv);
      }
    `;

    const module = this.device.createShaderModule({ code: shaderCode });
    this.pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module,
        entryPoint: 'vs_main',
      },
      fragment: {
        module,
        entryPoint: 'fs_main',
        targets: [{ format: this.format }],
      },
      primitive: { topology: 'triangle-list' },
      multisample: {
        count: MSAA_SAMPLE_COUNT,
      },
    });

    // 2. Background Gradient Pipeline setup
    const bgGradientShaderCode = `
      struct BgUniforms {
        bgType: u32,
        numColors: u32,
        angleDegrees: f32,
        blurValue: f32,
        colors: array<vec4<f32>, 16>,
      }

      struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) uv: vec2<f32>,
      }

      @vertex
      fn vs_bg(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
          var pos = array<vec2<f32>, 6>(
              vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0,  1.0),
              vec2<f32>(-1.0,  1.0), vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0)
          );
          var uv_coords = array<vec2<f32>, 6>(
              vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 1.0), vec2<f32>(0.0, 0.0),
              vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0), vec2<f32>(1.0, 0.0)
          );
          var out: VertexOutput;
          out.position = vec4<f32>(pos[VertexIndex], 0.0, 1.0);
          out.uv = uv_coords[VertexIndex];
          return out;
      }

      @group(0) @binding(0) var<uniform> bgUniforms: BgUniforms;

      fn get_gradient_color(uv: vec2<f32>) -> vec4<f32> {
          let n = bgUniforms.numColors;
          if (n == 0u) {
              return vec4<f32>(0.0, 0.0, 0.0, 1.0);
          }
          if (n == 1u) {
              return bgUniforms.colors[0];
          }

          var t = 0.0;
          if (bgUniforms.bgType == 1u) { // Linear gradient
              let angleRad = bgUniforms.angleDegrees * 3.14159265 / 180.0;
              let dir = vec2<f32>(cos(angleRad), sin(angleRad));
              let pt = uv - vec2<f32>(0.5);
              let dotProduct = dot(pt, dir);
              t = clamp(dotProduct + 0.5, 0.0, 1.0);
          } else if (bgUniforms.bgType == 2u) { // Radial gradient
              let dist = distance(uv, vec2<f32>(0.5)) * 2.0;
              t = clamp(dist, 0.0, 1.0);
          } else if (bgUniforms.bgType == 3u) { // Conic gradient
              let pt = uv - vec2<f32>(0.5);
              let angleRad = bgUniforms.angleDegrees * 3.14159265 / 180.0;
              let angle = atan2(pt.y, pt.x) - angleRad;
              t = fract((angle + 3.14159265) / (2.0 * 3.14159265));
          }

          let maxIdx = f32(n - 1u);
          let scaledT = t * maxIdx;
          let idx = u32(floor(scaledT));
          let nextIdx = min(idx + 1u, n - 1u);
          let localT = fract(scaledT);
          
          let c1 = bgUniforms.colors[idx];
          let c2 = bgUniforms.colors[nextIdx];
          return mix(c1, c2, localT);
      }

      @fragment
      fn fs_gradient(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
          if (bgUniforms.blurValue <= 0.0) {
              return get_gradient_color(uv);
          }
          
          var colorSum = vec4<f32>(0.0);
          var totalWeight = 0.0;
          let step = bgUniforms.blurValue * 0.0002;
          
          for (var x = -4.0; x <= 4.0; x += 1.0) {
              for (var y = -4.0; y <= 4.0; y += 1.0) {
                  let offset = vec2<f32>(x, y) * step;
                  let sampleUv = clamp(uv + offset, vec2<f32>(0.0), vec2<f32>(1.0));
                  let weight = 1.0 - (length(vec2<f32>(x, y)) / 6.0);
                  if (weight > 0.0) {
                      colorSum += get_gradient_color(sampleUv) * weight;
                      totalWeight += weight;
                  }
              }
          }
          return colorSum / totalWeight;
      }
    `;
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
