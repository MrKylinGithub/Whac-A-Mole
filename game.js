import { Matrix4 } from './js/matrix.js';
import { GameGeometry } from './js/geometry.js';
import { NNEngine } from './js/nnengine.js';
import { ParticleSystem } from './js/particle.js';

// 游戏状态
let engine;
let renderObjects = {};
let score = 0;
let activeMole = -1;
let moleTimer = null;
let scoreCanvas;
let scoreCtx;
let cameraShake = {
    active: false,
    duration: 0,
    intensity: 0,
    startTime: 0
};
let particleSystem;
let hitMoleColor = {
    r: 0.8,
    g: 0.4,
    b: 0.4,
    targetR: 1.0,
    targetG: 1.0,
    targetB: 0.2,
    transitionSpeed: 0.1
};

// 游戏配置
const HOLES_COUNT = 9;
const holes = [];

// 添加射线相关的工具函数
const Ray = {
    create: function() {
        return {
            origin: new Float32Array(3),
            direction: new Float32Array(3)
        };
    },

    // 从屏幕坐标计算射线
    fromScreen: function(out, normalizedX, normalizedY, projectionMatrix, viewMatrix) {
        // 计算投影矩阵和视图矩阵的逆矩阵
        const invProjection = Matrix4.create();
        const invView = Matrix4.create();
        Matrix4.invert(invProjection, projectionMatrix);
        Matrix4.invert(invView, viewMatrix);

        // 将屏幕坐标转换为裁剪空间坐标
        const clipCoords = new Float32Array([normalizedX, normalizedY, -1.0, 1.0]);
        
        // 转换到视空间
        const eyeCoords = new Float32Array(4);
        Matrix4.transformVector(eyeCoords, invProjection, clipCoords);
        eyeCoords[2] = -1.0;
        eyeCoords[3] = 0.0;
        
        // 转换到世界空间
        const worldCoords = new Float32Array(4);
        Matrix4.transformVector(worldCoords, invView, eyeCoords);
        
        // 设置射线原点（相机位置）
        out.origin[0] = invView[12];
        out.origin[1] = invView[13];
        out.origin[2] = invView[14];
        
        // 设置射线方向并归一化
        out.direction[0] = worldCoords[0];
        out.direction[1] = worldCoords[1];
        out.direction[2] = worldCoords[2];
        const len = Math.sqrt(
            out.direction[0] * out.direction[0] +
            out.direction[1] * out.direction[1] +
            out.direction[2] * out.direction[2]
        );
        out.direction[0] /= len;
        out.direction[1] /= len;
        out.direction[2] /= len;

        return out;
    },

    // 射线与球体相交检测
    intersectSphere: function(ray, center, radius) {
        const dx = ray.origin[0] - center[0];
        const dy = ray.origin[1] - center[1];
        const dz = ray.origin[2] - center[2];
        
        const B = 2.0 * (
            dx * ray.direction[0] +
            dy * ray.direction[1] +
            dz * ray.direction[2]
        );
        const C = dx * dx + dy * dy + dz * dz - radius * radius;
        
        const discriminant = B * B - 4 * C;
        if (discriminant < 0) return false;
        
        const t = (-B - Math.sqrt(discriminant)) / 2.0;
        return t >= 0;
    }
};

// 在游戏状态部分添加地鼠颜色配置
const MOLE_COLORS = [
    { r: 0.8, g: 0.4, b: 0.4 },  // 红色
    { r: 0.4, g: 0.6, b: 0.8 },  // 蓝色
    { r: 0.4, g: 0.8, b: 0.4 },  // 绿色
    { r: 0.8, g: 0.6, b: 0.2 },  // 橙色
    { r: 0.6, g: 0.4, b: 0.8 }   // 紫色
];

hitMoleColor = {
    r: MOLE_COLORS[0].r,
    g: MOLE_COLORS[0].g,
    b: MOLE_COLORS[0].b,
    targetR: 1.0,
    targetG: 1.0,
    targetB: 0.2,
    transitionSpeed: 0.1
};

function initHoles() {
    const spacing = 2;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            holes.push({
                x: (j - 1) * spacing,
                z: (i - 1) * spacing,
                hasMole: false
            });
        }
    }
}

function init() {
    // 初始化画布
    const canvas = wx.createCanvas();
    const systemInfo = wx.getSystemInfoSync();
    canvas.width = systemInfo.windowWidth;
    canvas.height = systemInfo.windowHeight;

    // 初始化渲染引擎
    engine = new NNEngine(canvas);
    
    // 初始化渲染对象
    initRenderObjects();
    
    // 初始化游戏
    initHoles();
    startGame();

    // 初始化分数显示
    scoreCanvas = wx.createCanvas();
    scoreCanvas.width = systemInfo.windowWidth;
    scoreCanvas.height = systemInfo.windowHeight;
    scoreCtx = scoreCanvas.getContext('2d');

    // 添加触摸事件
    wx.onTouchStart((res) => {
        const touch = res.touches[0];
        const x = (touch.clientX / canvas.width) * 2 - 1;
        const y = -((touch.clientY / canvas.height) * 2 - 1);
        
        // 创建射线
        const ray = Ray.create();
        Ray.fromScreen(
            ray,
            x,
            y,
            engine.projectionMatrix,
            engine.viewMatrix
        );
        
        // 检查点击
        checkHitTest(ray);
    });

    // 初始化粒子系统
    particleSystem = new ParticleSystem(engine, 50);

    requestAnimationFrame(render);
}

function initRenderObjects() {
    // 创建地面对象
    const groundColors = new Float32Array(GameGeometry.ground.vertices.length / 3 * 4);
    for (let i = 0; i < groundColors.length; i += 4) {
        groundColors[i] = 0.2;     // R
        groundColors[i + 1] = 0.8;  // G
        groundColors[i + 2] = 0.2;  // B
        groundColors[i + 3] = 1.0;  // A
    }
    renderObjects.ground = engine.createRenderObject(
        GameGeometry.ground.vertices,
        GameGeometry.ground.indices,
        groundColors
    );

    // 创建地鼠对象
    const moleColors = new Float32Array(GameGeometry.mole.vertices.length / 3 * 4);
    for (let i = 0; i < moleColors.length; i += 4) {
        moleColors[i] = hitMoleColor.r;     // R
        moleColors[i + 1] = hitMoleColor.g;  // G
        moleColors[i + 2] = hitMoleColor.b;  // B
        moleColors[i + 3] = 1.0;  // A
    }
    renderObjects.mole = engine.createRenderObject(
        GameGeometry.mole.vertices,
        GameGeometry.mole.indices,
        moleColors
    );

    // 创建洞对象
    const holeColors = new Float32Array(GameGeometry.hole.vertices.length / 3 * 4);
    holeColors.fill(0.2);
    renderObjects.hole = engine.createRenderObject(
        GameGeometry.hole.vertices,
        GameGeometry.hole.indices,
        holeColors
    );
}

function render() {
    // 开始新一帧
    engine.beginFrame([0.5, 0.7, 1.0, 1.0]);

    // 设置投影
    engine.setPerspective(
        45 * Math.PI / 180,
        engine.gl.canvas.width / engine.gl.canvas.height,
        0.1,
        100.0
    );

    // 计算相机抖动
    let shakeOffsetX = 0;
    let shakeOffsetY = 0;
    if (cameraShake.active) {
        const elapsed = Date.now() - cameraShake.startTime;
        if (elapsed < cameraShake.duration) {
            const progress = elapsed / cameraShake.duration;
            const decay = 1 - progress;
            const shake = Math.sin(progress * 50) * cameraShake.intensity * decay;
            shakeOffsetX = (Math.random() - 0.5) * shake;
            shakeOffsetY = (Math.random() - 0.5) * shake;
        } else {
            cameraShake.active = false;
        }
    }

    // 设置相机
    engine.setCamera(
        [shakeOffsetX, -2.0 + shakeOffsetY, -12.0],
        [Math.PI / 6, 0, 0]
    );

    // 渲染场景对象
    engine.drawObject(renderObjects.ground, engine.viewMatrix);

    // 更新地鼠颜色
    updateMoleColor();

    // 渲染洞和地鼠
    holes.forEach((hole, index) => {
        const holeMatrix = Matrix4.create();
        Matrix4.identity(holeMatrix);
        Matrix4.translate(holeMatrix, engine.viewMatrix, [hole.x, 0.01, hole.z]);
        engine.drawObject(renderObjects.hole, holeMatrix);

        if (index === activeMole) {
            const moleMatrix = Matrix4.create();
            Matrix4.identity(moleMatrix);
            Matrix4.translate(moleMatrix, engine.viewMatrix, [hole.x, 0.3, hole.z]);
            
            // 更新地鼠颜色缓冲区
            const moleColors = new Float32Array(GameGeometry.mole.vertices.length / 3 * 4);
            for (let i = 0; i < moleColors.length; i += 4) {
                moleColors[i] = hitMoleColor.r;
                moleColors[i + 1] = hitMoleColor.g;
                moleColors[i + 2] = hitMoleColor.b;
                moleColors[i + 3] = 1.0;
            }
            engine.updateBuffer(renderObjects.mole.color, moleColors);
            
            engine.drawObject(renderObjects.mole, moleMatrix);
        }
    });

    // 渲染分数
    drawScore();

    // 更新和渲染粒子系统
    particleSystem.update();
    particleSystem.render();

    requestAnimationFrame(render);
}

function drawScore() {
    scoreCtx.clearRect(0, 0, scoreCanvas.width, scoreCanvas.height);
    scoreCtx.fillStyle = '#ffffff';
    scoreCtx.font = 'bold 32px Arial';
    scoreCtx.textBaseline = 'top';
    scoreCtx.fillText(`分数: ${score}`, 20, 20);
}

function checkHitTest(ray) {
    if (activeMole < 0) return;

    const hole = holes[activeMole];
    const moleCenter = [hole.x, 0.3, hole.z];
    const moleRadius = 0.3;

    if (Ray.intersectSphere(ray, moleCenter, moleRadius)) {
        // 设置击中时的目标颜色（明亮的金色）
        hitMoleColor.targetR = 1.0;
        hitMoleColor.targetG = 1.0;
        hitMoleColor.targetB = 0.2;

        wx.vibrateShort();
        score += 100;
        activeMole = -1;
        if (moleTimer) clearTimeout(moleTimer);
        
        // 在地鼠位置触发粒子效果
        particleSystem.emit(moleCenter);
        startCameraShake(200, 0.2);

        // 延迟生成新地鼠（这样可以看到颜色变化效果）
        setTimeout(spawnMole, 300);
    }
}

function startGame() {
    score = 0;
    spawnMole();
}

function spawnMole() {
    activeMole = Math.floor(Math.random() * HOLES_COUNT);
    
    // 随机选择新的地鼠颜色
    const newColor = MOLE_COLORS[Math.floor(Math.random() * MOLE_COLORS.length)];
    hitMoleColor.r = newColor.r;
    hitMoleColor.g = newColor.g;
    hitMoleColor.b = newColor.b;
    // 同时更新目标颜色，这样不会有过渡动画
    hitMoleColor.targetR = newColor.r;
    hitMoleColor.targetG = newColor.g;
    hitMoleColor.targetB = newColor.b;

    if (moleTimer) clearTimeout(moleTimer);
    moleTimer = setTimeout(() => {
        activeMole = -1;
        setTimeout(spawnMole, 300);
    }, 1500);
}

function startCameraShake(duration, intensity) {
    cameraShake.active = true;
    cameraShake.duration = duration;
    cameraShake.intensity = intensity;
    cameraShake.startTime = Date.now();
}

// 添加颜色更新函数
function updateMoleColor() {
    // 平滑过渡到目标颜色
    hitMoleColor.r += (hitMoleColor.targetR - hitMoleColor.r) * hitMoleColor.transitionSpeed;
    hitMoleColor.g += (hitMoleColor.targetG - hitMoleColor.g) * hitMoleColor.transitionSpeed;
    hitMoleColor.b += (hitMoleColor.targetB - hitMoleColor.b) * hitMoleColor.transitionSpeed;
}

// 启动游戏
init();