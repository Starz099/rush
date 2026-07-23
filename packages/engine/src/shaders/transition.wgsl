struct TransitionUniforms {
    canvasResolution: vec2<f32>,
    progress: f32,
    transitionType: u32, // 1 = Fade, 2 = Slide, 3 = Wipe, 4 = Zoom, 5 = Spin, 6 = Glitch
    direction: vec2<f32>, // e.g. (1.0, 0.0) for slide right
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
}

@vertex
fn vs_transition(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
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

@group(0) @binding(0) var mySampler: sampler;
@group(0) @binding(1) var textureA: texture_external;
@group(0) @binding(2) var textureB: texture_external;
@group(0) @binding(3) var<uniform> uniforms: TransitionUniforms;

// Hash function for random noise (needed for Glitch)
fn hash(p: vec2<f32>) -> f32 {
    let h = dot(p, vec2<f32>(127.1, 311.7));
    return fract(sin(h) * 43758.5453123);
}

@fragment
fn fs_transition(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let p = uniforms.progress;
    
    switch (uniforms.transitionType) {
        // Cross Dissolve (Fade)
        case 1u: {
            let colorA = textureSampleBaseClampToEdge(textureA, mySampler, uv);
            let colorB = textureSampleBaseClampToEdge(textureB, mySampler, uv);
            return mix(colorA, colorB, p);
        }

        // Slide / Push
        case 2u: {
            // Calculate offsets based on direction vector
            let offsetA = uv - uniforms.direction * p;
            let offsetB = uv + uniforms.direction * (1.0 - p);

            let inA = step(0.0, offsetA.x) * step(offsetA.x, 1.0) * step(0.0, offsetA.y) * step(offsetA.y, 1.0);
            let inB = step(0.0, offsetB.x) * step(offsetB.x, 1.0) * step(0.0, offsetB.y) * step(offsetB.y, 1.0);

            if (inB > 0.5) {
                return textureSampleBaseClampToEdge(textureB, mySampler, offsetB);
            } else if (inA > 0.5) {
                return textureSampleBaseClampToEdge(textureA, mySampler, offsetA);
            }
            return vec4<f32>(0.0, 0.0, 0.0, 1.0);
        }

        // Linear Wipe
        case 3u: {
            // Horizontal wipe line sweeping left-to-right
            if (uv.x < p) {
                return textureSampleBaseClampToEdge(textureB, mySampler, uv);
            }
            return textureSampleBaseClampToEdge(textureA, mySampler, uv);
        }

        // Zoom / Scale Cross
        case 4u: {
            // Zoom A out, zoom B in
            let center = vec2<f32>(0.5, 0.5);
            
            let scaleA = 1.0 + p * 3.0; // Zooms in/magnifies outgoing
            let scaleB = 1.0 - (1.0 - p) * 0.8; // Incoming starts small and pops up

            let uvA = (uv - center) / scaleA + center;
            let uvB = (uv - center) / scaleB + center;

            let colorA = textureSampleBaseClampToEdge(textureA, mySampler, uvA);
            let colorB = textureSampleBaseClampToEdge(textureB, mySampler, uvB);
            
            return mix(colorA, colorB, p);
        }

        // Spin / Twist
        case 5u: {
            let center = vec2<f32>(0.5, 0.5);
            let angle = p * 6.2831853; // Full rotation
            
            let cosA = cos(angle);
            let sinA = sin(angle);
            
            let d = uv - center;
            let rotatedUv = vec2<f32>(
                d.x * cosA - d.y * sinA,
                d.x * sinA + d.y * cosA
            ) + center;

            let colorA = textureSampleBaseClampToEdge(textureA, mySampler, rotatedUv);
            let colorB = textureSampleBaseClampToEdge(textureB, mySampler, rotatedUv);
            return mix(colorA, colorB, p);
        }

        // Glitch / Block Noise
        case 6u: {
            // Create digital noise blocks by slicing UVs
            let blockCount = vec2<f32>(15.0, 30.0);
            let blockUv = floor(uv * blockCount) / blockCount;
            let n = hash(blockUv + vec2<f32>(p * 13.0, p * 37.0));
            
            var glitchUv = uv;
            // Displace coordinates horizontally depending on hash noise
            if (n < p * 0.4) {
                glitchUv.x = fract(glitchUv.x + sin(n * 6.28) * 0.1);
            }
            
            let colorA = textureSampleBaseClampToEdge(textureA, mySampler, glitchUv);
            let colorB = textureSampleBaseClampToEdge(textureB, mySampler, glitchUv);
            return mix(colorA, colorB, p);
        }

        default: {
            return textureSampleBaseClampToEdge(textureB, mySampler, uv);
        }
    }
}
