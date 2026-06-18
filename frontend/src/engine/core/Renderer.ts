import type { Transform } from '@/api/bindings'

export class WebGPURenderer {
  private canvas: HTMLCanvasElement
  private device!: GPUDevice
  private context!: GPUCanvasContext
  private pipeline!: GPURenderPipeline
  private format: GPUTextureFormat = 'bgra8unorm'
  private disposed: boolean = false
  private currentCommandEncoder: GPUCommandEncoder | null = null
  private currentRenderPass: GPURenderPassEncoder | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  public async initialize() {
    if (!navigator.gpu) {
      throw new Error('WebGPU is not supported on this browser.')
    }

    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter) throw new Error('No GPU found.')

    this.device = await adapter.requestDevice()
    this.context = this.canvas.getContext('webgpu') as GPUCanvasContext
    this.format = navigator.gpu.getPreferredCanvasFormat()

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied',
    })

    this.setupPipeline()
  }
  public beginFrame() {
    if (this.disposed || !this.device || !this.context) return
    this.currentCommandEncoder = this.device.createCommandEncoder()

    const textureView = this.context.getCurrentTexture().createView()
    this.currentRenderPass = this.currentCommandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    })

    // Set the pipeline once at the start of the frame
    this.currentRenderPass.setPipeline(this.pipeline)
  }

  public drawClip(frame: VideoFrame, transform: Transform | null) {
    if (!this.currentRenderPass || !this.device) {
      return
    }

    // prepare the texture from the VideoFrame
    const externalTexture = this.device.importExternalTexture({ source: frame })
    const sampler = this.device.createSampler()

    // Prepare the Uniform Data (MUST match the Shader struct above)
    const uniformData = new Float32Array([
      this.canvas.width, // canvasResolution.x
      this.canvas.height, // canvasResolution.y
      frame.displayWidth, // frameResolution.x
      frame.displayHeight, // frameResolution.y
      transform?.x ?? 0, // position.x
      transform?.y ?? 0, // position.y
      transform?.scale ?? 1, // scale
      0, // Padding (for 16-byte alignment)
    ])

    const uniformBuffer = this.device.createBuffer({
      size: uniformData.byteLength,
      // usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      usage: 64 | 8,
    })
    this.device.queue.writeBuffer(uniformBuffer, 0, uniformData)

    // Create the Bind Group for this specific clip
    const bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: externalTexture },
        { binding: 2, resource: { buffer: uniformBuffer } },
      ],
    })

    // Record the draw command into the current pass
    this.currentRenderPass.setBindGroup(0, bindGroup)
    this.currentRenderPass.draw(6)
  }

  public setupPipeline() {
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
    `

    const module = this.device.createShaderModule({ code: shaderCode })
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
    })
  }

  public endFrame() {
    if (!this.currentCommandEncoder || !this.currentRenderPass) return

    this.currentRenderPass.end()
    this.device.queue.submit([this.currentCommandEncoder.finish()])

    this.currentCommandEncoder = null
    this.currentRenderPass = null
  }

  public dispose() {
    this.disposed = true
  }
}
