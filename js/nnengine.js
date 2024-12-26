import { Matrix4 } from './matrix.js';

// WebGL渲染引擎
export class NNEngine {
    constructor(canvas) {
        this.gl = canvas.getContext('webgl');
        this.programInfo = null;
        this.viewMatrix = Matrix4.create();
        this.projectionMatrix = Matrix4.create();
        
        if (!this.gl) {
            throw new Error('无法初始化 WebGL');
        }
        
        // 初始化基本着色器
        this.initDefaultShaders();
    }

    // 初始化默认着色器
    initDefaultShaders() {
        const vsSource = `
            attribute vec4 aPosition;
            attribute vec4 aColor;
            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            varying vec4 vColor;
            
            void main() {
                gl_Position = uProjectionMatrix * uModelViewMatrix * aPosition;
                vColor = aColor;
            }
        `;

        const fsSource = `
            precision mediump float;
            varying vec4 vColor;
            
            void main() {
                gl_FragColor = vColor;
            }
        `;

        const shaderProgram = this.initShaderProgram(vsSource, fsSource);
        this.programInfo = {
            program: shaderProgram,
            attribLocations: {
                position: this.gl.getAttribLocation(shaderProgram, 'aPosition'),
                color: this.gl.getAttribLocation(shaderProgram, 'aColor'),
            },
            uniformLocations: {
                projectionMatrix: this.gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
                modelViewMatrix: this.gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
            },
        };
    }

    // 创建缓冲区
    createBuffer(data) {
        const buffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(data), this.gl.STATIC_DRAW);
        return buffer;
    }

    // 创建索引缓冲区
    createIndexBuffer(data) {
        const buffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, buffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data), this.gl.STATIC_DRAW);
        return buffer;
    }

    // 创建渲染对象
    createRenderObject(vertices, indices, colors) {
        return {
            position: this.createBuffer(vertices),
            color: this.createBuffer(colors),
            indices: this.createIndexBuffer(indices),
            count: indices.length
        };
    }

    // 开始新一帧的渲染
    beginFrame(clearColor = [0.5, 0.7, 1.0, 1.0]) {
        const gl = this.gl;
        gl.clearColor(...clearColor);
        gl.clearDepth(1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    // 设置相机
    setCamera(position, rotation) {
        Matrix4.identity(this.viewMatrix);
        Matrix4.translate(this.viewMatrix, this.viewMatrix, position);
        if (rotation) {
            Matrix4.rotate(this.viewMatrix, this.viewMatrix, rotation[0], [1, 0, 0]);
            Matrix4.rotate(this.viewMatrix, this.viewMatrix, rotation[1], [0, 1, 0]);
            Matrix4.rotate(this.viewMatrix, this.viewMatrix, rotation[2], [0, 0, 1]);
        }
    }

    // 设置投影矩阵
    setPerspective(fovy, aspect, near, far) {
        Matrix4.perspective(this.projectionMatrix, fovy, aspect, near, far);
    }

    // 渲染对象
    drawObject(renderObject, modelMatrix) {
        const gl = this.gl;
        
        gl.useProgram(this.programInfo.program);

        // 设置顶点属性
        gl.bindBuffer(gl.ARRAY_BUFFER, renderObject.position);
        gl.vertexAttribPointer(
            this.programInfo.attribLocations.position,
            3, gl.FLOAT, false, 0, 0
        );
        gl.enableVertexAttribArray(this.programInfo.attribLocations.position);

        // 设置颜色属性
        gl.bindBuffer(gl.ARRAY_BUFFER, renderObject.color);
        gl.vertexAttribPointer(
            this.programInfo.attribLocations.color,
            4, gl.FLOAT, false, 0, 0
        );
        gl.enableVertexAttribArray(this.programInfo.attribLocations.color);

        // 设置矩阵
        gl.uniformMatrix4fv(
            this.programInfo.uniformLocations.projectionMatrix,
            false,
            this.projectionMatrix
        );
        gl.uniformMatrix4fv(
            this.programInfo.uniformLocations.modelViewMatrix,
            false,
            modelMatrix
        );

        // 绘制
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, renderObject.indices);
        gl.drawElements(gl.TRIANGLES, renderObject.count, gl.UNSIGNED_SHORT, 0);
    }

    // 初始化着色器程序
    initShaderProgram(vsSource, fsSource) {
        const vertexShader = this.loadShader(this.gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this.loadShader(this.gl.FRAGMENT_SHADER, fsSource);

        const shaderProgram = this.gl.createProgram();
        this.gl.attachShader(shaderProgram, vertexShader);
        this.gl.attachShader(shaderProgram, fragmentShader);
        this.gl.linkProgram(shaderProgram);

        if (!this.gl.getProgramParameter(shaderProgram, this.gl.LINK_STATUS)) {
            throw new Error('无法初始化着色器程序: ' + this.gl.getProgramInfoLog(shaderProgram));
        }

        return shaderProgram;
    }

    // 加载着色器
    loadShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            this.gl.deleteShader(shader);
            throw new Error('编译着色器时发生错误: ' + this.gl.getShaderInfoLog(shader));
        }

        return shader;
    }

    // 添加更新缓冲区的方法
    updateBuffer(buffer, data) {
        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    }
} 