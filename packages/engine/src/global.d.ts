// WebGPU constants declarations for TypeScript compiler when @webgpu/types is not loaded.
declare const GPUBufferUsage: {
  MAP_READ: number;
  MAP_WRITE: number;
  COPY_SRC: number;
  COPY_DST: number;
  INDEX: number;
  VERTEX: number;
  UNIFORM: number;
  STORAGE: number;
  INDIRECT: number;
  QUERY_RESOLVE: number;
};

declare const GPUTextureUsage: {
  COPY_SRC: number;
  COPY_DST: number;
  TEXTURE_BINDING: number;
  STORAGE_BINDING: number;
  RENDER_ATTACHMENT: number;
};

declare const GPUMapMode: {
  READ: number;
  WRITE: number;
};

declare module '*.wgsl?raw' {
  const content: string;
  export default content;
}

declare module '*.wgsl' {
  const content: string;
  export default content;
}
