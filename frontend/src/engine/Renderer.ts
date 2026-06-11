export class WebGPURenderer {
  private canvas: HTMLCanvasElement
  private device!: GPUDevice
  private context!: GPUCanvasContext
  private pipeline!: GPURenderPipeline
  private format: GPUTextureFormat = 'bgra8unorm'
  private disposed: boolean = false

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  public dispose() {
    this.disposed = true
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

  public setupPipeline() {
    const shaderCode = `
      struct Uniforms {
        canvasResolution: vec2<f32>,
        frameResolution: vec2<f32>,
      }

      @group(0) @binding(0) var mySampler: sampler;
      @group(0) @binding(1) var myTexture: texture_external;
      @group(0) @binding(2) var<uniform> uniforms: Uniforms;

      @vertex
      fn vs_main(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4<f32> {
          var pos = array<vec2<f32>, 6>(
              vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0,  1.0),
              vec2<f32>(-1.0,  1.0), vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0)
          );
          return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
      }

      @fragment
      fn fs_main(@builtin(position) coord: vec4<f32>) -> @location(0) vec4<f32> {
          let canvasRes = uniforms.canvasResolution;
          let frameRes = uniforms.frameResolution;

          let canvasAspect = canvasRes.x / canvasRes.y;
          let frameAspect = frameRes.x / frameRes.y;

          var uv: vec2<f32>;

          if (frameAspect > canvasAspect) {
              // Asset is wider than canvas (Letterbox)
              // We fit to canvas width.
              let scale = canvasAspect / frameAspect;
              let verticalOffset = (1.0 - scale) * 0.5;
              
              uv = vec2<f32>(
                  coord.x / canvasRes.x,
                  ((coord.y / canvasRes.y) - verticalOffset) / scale
              );
          } else {
              // Asset is taller than canvas (Pillarbox)
              // We fit to canvas height.
              let scale = frameAspect / canvasAspect;
              let horizontalOffset = (1.0 - scale) * 0.5;
              
              uv = vec2<f32>(
                  ((coord.x / canvasRes.x) - horizontalOffset) / scale,
                  coord.y / canvasRes.y
              );
          }

          // Strict bound check for letterboxing/pillarboxing
          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
              return vec4<f32>(0.0, 0.0, 0.0, 1.0);
          }

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

  private isDrawing = false

  public draw(frame: VideoFrame) {
    if (this.disposed || !this.device || !this.pipeline) {
      frame.close()
      return
    }

    // If the GPU queue is already busy with a previous frame from this tick,
    // skip this one to maintain 60fps fluidity (avoiding backlog).
    if (this.isDrawing) {
      frame.close()
      return
    }

    this.isDrawing = true

    try {
      const externalTexture = this.device.importExternalTexture({
        source: frame,
      })
      const sampler = this.device.createSampler()

      // Create uniform buffer
      const uniformData = new Float32Array([
        this.canvas.width,
        this.canvas.height,
        frame.displayWidth,
        frame.displayHeight,
      ])
      const uniformBuffer = this.device.createBuffer({
        size: uniformData.byteLength,
        // GPUBufferUsage.UNIFORM (64) | GPUBufferUsage.COPY_DST (8)
        usage: 64 | 8,
      })
      this.device.queue.writeBuffer(uniformBuffer, 0, uniformData)

      const bindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: externalTexture },
          { binding: 2, resource: { buffer: uniformBuffer } },
        ],
      })

      const commandEncoder = this.device.createCommandEncoder()
      const textureView = this.context.getCurrentTexture().createView()

      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: textureView,
            clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      })

      renderPass.setPipeline(this.pipeline)
      renderPass.setBindGroup(0, bindGroup)
      renderPass.draw(6)
      renderPass.end()

      this.device.queue.submit([commandEncoder.finish()])
    } finally {
      frame.close()
      this.isDrawing = false
    }
  }
}
