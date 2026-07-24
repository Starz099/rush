struct Uniforms {
    canvasResolution: vec2<f32>,
    frameResolution: vec2<f32>,
    position: vec2<f32>,
    anchor: vec2<f32>,
    scale: f32,
    rotation: f32,
    opacity: f32,
    brightness: f32,
    contrast: f32,
    saturation: f32,
    vignette: f32,
    padding: f32,
}

struct VertexOutput {
    @builtin(position) Position : vec4<f32>,
    @location(0) uv : vec2<f32>,
    @location(1) opacity : f32,
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
    out.opacity = uniforms.opacity;

    // Shift relative to anchor point (transform center)
    let anchorShift = (uniforms.anchor - vec2<f32>(0.5, 0.5)) * 2.0;
    p = p - anchorShift;

    // Apply scale
    p = p * uniforms.scale;

    // Apply rotation (degrees to radians)
    let rad = uniforms.rotation * 3.14159265 / 180.0;
    let cosR = cos(rad);
    let sinR = sin(rad);
    p = vec2<f32>(
        p.x * cosR - p.y * sinR,
        p.x * sinR + p.y * cosR
    );

    // Shift back
    p = p + anchorShift;

    // Convert pixel position to NDC (-1 to 1)
    let offset = vec2<f32>(
      (uniforms.position.x / uniforms.canvasResolution.x) * 2.0,
      -(uniforms.position.y / uniforms.canvasResolution.y) * 2.0
    );

    out.Position = vec4<f32>(p + offset, 0.0, 1.0);
    return out;
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>, @location(1) opacity: f32) -> @location(0) vec4<f32> {
    var color = textureSampleBaseClampToEdge(myTexture, mySampler, uv);
    
    // Brightness
    color = vec4<f32>(color.rgb * uniforms.brightness, color.a);
    
    // Contrast
    color = vec4<f32>((color.rgb - 0.5) * uniforms.contrast + 0.5, color.a);
    
    // Apply Saturation
    let luma = 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
    let gray = vec3<f32>(luma);
    color = vec4<f32>(mix(gray, color.rgb, uniforms.saturation), color.a);
    
    // Apply Vignette (darken corners based on distance from center UV)
    let dist = distance(uv, vec2<f32>(0.5, 0.5));
    let vig = smoothstep(0.8, 0.4, dist * uniforms.vignette);
    color = vec4<f32>(color.rgb * vig, color.a);
    
    color.a = color.a * opacity;
    return color;
}
