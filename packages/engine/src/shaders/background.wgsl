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
