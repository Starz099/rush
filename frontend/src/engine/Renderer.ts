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

    this.setupPipeline(this.canvas.width, this.canvas.height)
  }

  public setupPipeline(width: number, height: number) {
    const shaderCode = `
      // The Vertex Shader: Draws a full-screen rectangle
      @vertex
      fn vs_main(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4<f32> {
          var pos = array<vec2<f32>, 6>(
              vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0,  1.0),
              vec2<f32>(-1.0,  1.0), vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0)
          );
          return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
      }

      // The Fragment Shader: Paints the VideoFrame onto the rectangle
      @group(0) @binding(0) var mySampler: sampler;
      @group(0) @binding(1) var myTexture: texture_external;

      @fragment
      fn fs_main(@builtin(position) coord: vec4<f32>) -> @location(0) vec4<f32> {
          // Convert screen coordinates to texture UV coordinates
          let resolution = vec2<f32>(${width}.0, ${height}.0);
          let uv = vec2<f32>(coord.x / resolution.x, coord.y / resolution.y);
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

  public draw(frame: VideoFrame) {
    if (this.disposed || !this.device || !this.pipeline) {
      frame.close()
      return
    }

    // Securely blast the VideoFrame into GPU memory
    const externalTexture = this.device.importExternalTexture({ source: frame })
    const sampler = this.device.createSampler()

    // Bind the texture to the shader
    const bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: externalTexture },
      ],
    })

    // Instruct the GPU to draw
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
    renderPass.draw(6) // Draw our 6 vertices
    renderPass.end()

    this.device.queue.submit([commandEncoder.finish()])

    // CRITICAL MEMORY MANAGEMENT: Now that the GPU has it, clear the RAM.
    frame.close()
  }
}
