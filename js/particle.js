import { Matrix4 } from './matrix.js';

// 粒子系统
export class ParticleSystem {
    constructor(engine, count = 200) {
        this.engine = engine;
        this.maxParticles = count;
        this.particles = [];
        this.active = false;
        this.position = [0, 0, 0];
        this.particleColors = new Float32Array(16); // 4个顶点 * 4个分量(RGBA)

        // 创建粒子渲染对象
        this.initParticleRenderObject();
    }

    // 初始化粒子渲染对象
    initParticleRenderObject() {
        // 创建一个更小的方块作为粒子
        const vertices = [
            -0.05,  0.05, 0.0,  // 增大到原来的2.5倍
             0.05,  0.05, 0.0,
             0.05, -0.05, 0.0,
            -0.05, -0.05, 0.0,
        ];

        const indices = [0, 1, 2, 0, 2, 3];

        // 使用更亮的颜色
        const colors = new Float32Array([
            1.0, 0.9, 0.2, 1.0,  // 更亮的金色
            1.0, 0.9, 0.2, 1.0,
            1.0, 0.9, 0.2, 1.0,
            1.0, 0.9, 0.2, 1.0
        ]);

        this.renderObject = this.engine.createRenderObject(vertices, indices, colors);
    }

    // 发射粒子
    emit(position) {
        this.active = true;
        this.position = position;
        this.particles = [];

        // 创建新的粒子，增加数量
        for (let i = 0; i < this.maxParticles; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.2 + Math.random() * 0.3;  // 增加速度
            
            // 调整颜色分布
            const colorType = Math.random();
            let color;
            if (colorType < 0.4) {
                color = [1.0, 0.9, 0.2, 1.0];  // 明亮的金色
            } else if (colorType < 0.7) {
                color = [1.0, 1.0, 0.6, 1.0];  // 更亮的黄色
            } else {
                color = [1.0, 0.7, 0.2, 1.0];  // 橙色
            }

            const particle = {
                position: [...position],
                velocity: [
                    Math.cos(angle) * speed,
                    0.4 + Math.random() * 0.5,  // 增加向上的初始速度
                    Math.sin(angle) * speed
                ],
                life: 1.0,
                scale: 0.6 + Math.random() * 0.8,  // 增大缩放范围
                color: color,
                rotationSpeed: (Math.random() - 0.5) * 0.2  // 添加旋转
            };
            this.particles.push(particle);
        }
    }

    // 更新粒子系统
    update() {
        if (!this.active) return;

        let allDead = true;
        const gravity = -0.012;  // 减小重力，让粒子飘得更久

        // 更新每个粒子
        for (let particle of this.particles) {
            if (particle.life > 0) {
                // 更新位置
                particle.position[0] += particle.velocity[0];
                particle.position[1] += particle.velocity[1];
                particle.position[2] += particle.velocity[2];

                // 应用重力
                particle.velocity[1] += gravity;

                // 减少生命值
                particle.life -= 0.015;  // 减慢消失速度
                allDead = false;

                // 缓慢缩小
                particle.scale *= 0.99;
            }
        }

        if (allDead) {
            this.active = false;
        }
    }

    // 渲染粒子系统
    render() {
        if (!this.active) return;

        // 启用混合
        this.engine.gl.enable(this.engine.gl.BLEND);
        this.engine.gl.blendFunc(this.engine.gl.SRC_ALPHA, this.engine.gl.ONE);

        for (let particle of this.particles) {
            if (particle.life <= 0) continue;

            // 创建变换矩阵
            const matrix = Matrix4.create();
            Matrix4.identity(matrix);
            Matrix4.translate(matrix, this.engine.viewMatrix, particle.position);

            // 根据粒子scale调整大小
            Matrix4.scale(matrix, matrix, [particle.scale, particle.scale, particle.scale]);

            // 更新颜色缓冲区
            for (let i = 0; i < 4; i++) {
                this.particleColors[i * 4] = particle.color[0];
                this.particleColors[i * 4 + 1] = particle.color[1];
                this.particleColors[i * 4 + 2] = particle.color[2];
                this.particleColors[i * 4 + 3] = particle.color[3] * particle.life;
            }
            this.engine.updateBuffer(this.renderObject.color, this.particleColors);
            
            // 渲染粒子
            this.engine.drawObject(this.renderObject, matrix);
        }

        // 恢复混合设置
        this.engine.gl.disable(this.engine.gl.BLEND);
    }
} 