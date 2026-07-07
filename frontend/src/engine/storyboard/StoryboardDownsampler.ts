export class StoryboardDownsampler {
  private device: GPUDevice;
  private lumaTexture: GPUTexture;
  private stagingBuffer: GPUBuffer;
  private pipeline: GPURenderPipeline;
  private sampler: GPUSampler;

  constructor(device: GPUDevice) {
    this.device = device;

    this.lumaTexture = device.createTexture({
      size: [64, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });

    this.stagingBuffer = device.createBuffer({
      size: 256,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    this.sampler = device.createSampler({
      minFilter: 'linear',
      magFilter: 'linear',
    });

    const shaderModule = device.createShaderModule({
      code: `
        @group(0) @binding(0) var mySampler: sampler;
        @group(0) @binding(1) var myTexture: texture_2d<f32>;

        struct VertexOutput {
          @builtin(position) position: vec4<f32>,
          @location(0) uv: vec2<f32>,
        }

        @vertex
        fn vs_main(@builtin(vertex_index) index: u32) -> VertexOutput {
          var pos = array<vec2<f32>, 4>(
            vec2<f32>(-1.0, -1.0),
            vec2<f32>(1.0, -1.0),
            vec2<f32>(-1.0, 1.0),
            vec2<f32>(1.0, 1.0)
          );
          var uvs = array<vec2<f32>, 4>(
            vec2<f32>(0.0, 1.0),
            vec2<f32>(1.0, 1.0),
            vec2<f32>(0.0, 0.0),
            vec2<f32>(1.0, 0.0)
          );
          var out: VertexOutput;
          out.position = vec4<f32>(pos[index], 0.0, 1.0);
          out.uv = uvs[index];
          return out;
        }

        @fragment
        fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
          let color = textureSample(myTexture, mySampler, uv);
          let luma = 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
          return vec4<f32>(luma, luma, luma, color.a);
        }
      `,
    });

    this.pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: shaderModule, entryPoint: 'vs_main' },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{ format: 'rgba8unorm' }],
      },
      primitive: { topology: 'triangle-strip' },
    });
  }

  public async getFrameLumaGrid(
    sourceTexture: GPUTexture,
  ): Promise<Float32Array> {
    const bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: sourceTexture.createView() },
      ],
    });

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.lumaTexture.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(4);
    pass.end();

    encoder.copyTextureToBuffer(
      { texture: this.lumaTexture },
      { buffer: this.stagingBuffer, bytesPerRow: 256 },
      { width: 64, height: 1 },
    );

    this.device.queue.submit([encoder.finish()]);

    await this.stagingBuffer.mapAsync(GPUMapMode.READ);
    const mapped = new Uint8Array(this.stagingBuffer.getMappedRange());

    const grid = new Float32Array(64);
    for (let i = 0; i < 64; i++) {
      grid[i] = mapped[i * 4] / 255.0;
    }
    this.stagingBuffer.unmap();

    return grid;
  }

  public dispose() {
    this.lumaTexture.destroy();
    this.stagingBuffer.destroy();
  }
}
