// 生成球体顶点和索引
function createSphere(radius, segments) {
    const vertices = [];
    const indices = [];
    
    for (let lat = 0; lat <= segments; lat++) {
        const theta = lat * Math.PI / segments;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        for (let lon = 0; lon <= segments; lon++) {
            const phi = lon * 2 * Math.PI / segments;
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);

            const x = cosPhi * sinTheta * radius;
            const y = cosTheta * radius;
            const z = sinPhi * sinTheta * radius;

            vertices.push(x, y, z);
        }
    }

    for (let lat = 0; lat < segments; lat++) {
        for (let lon = 0; lon < segments; lon++) {
            const first = (lat * (segments + 1)) + lon;
            const second = first + segments + 1;

            indices.push(first, second, first + 1);
            indices.push(second, second + 1, first + 1);
        }
    }

    return { vertices, indices };
}

// 创建平面
function createPlane(width, height) {
    const vertices = [
        -width/2, 0, -height/2,
        width/2, 0, -height/2,
        width/2, 0, height/2,
        -width/2, 0, height/2,
    ];

    const indices = [
        0, 1, 2,
        0, 2, 3
    ];

    return { vertices, indices };
}

export const GameGeometry = {
    // 地面
    ground: createPlane(10, 10),
    // 地鼠（球体）
    mole: createSphere(0.3, 12),
    // 洞（简单的平面圆）
    hole: createPlane(0.8, 0.8)
}; 