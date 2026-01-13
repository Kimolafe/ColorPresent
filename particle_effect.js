class ParticleEffect {
    constructor(scene) {
        this.scene = scene;
        this.particleSystems = [];
        this.activeEffects = [];
    }
    
    triggerEffect(buildingIndex) {
        // 根据建筑索引确定是哪个建筑需要特效
        let building;
        if (buildingIndex === 0) {
            building = this.scene.getObjectByName('building1') || this.scene.children.find(obj => obj.id && obj.id.toString().endsWith('1'));
        } else if (buildingIndex === 1) {
            building = this.scene.getObjectByName('building2') || this.scene.children.find(obj => obj.id && obj.id.toString().endsWith('2'));
        }
        
        if (building) {
            // 创建粒子分解特效（从建筑到粒子）
            this.createDisintegrationEffect(building, buildingIndex);
        }
    }
    
    createDisintegrationEffect(building, buildingIndex) {
        // 获取建筑几何体信息，创建粒子
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const targets = [];
        const colors = [];
        
        // 从建筑模型中提取顶点信息
        building.updateMatrixWorld();
        building.traverse((child) => {
            if (child.isMesh) {
                const meshGeometry = child.geometry.clone();
                meshGeometry.applyMatrix4(child.matrixWorld);
                
                const posAttribute = meshGeometry.getAttribute('position');
                if(posAttribute) {
                    for (let i = 0; i < posAttribute.count; i++) {
                        const v = new THREE.Vector3(
                            posAttribute.getX(i),
                            posAttribute.getY(i),
                            posAttribute.getZ(i)
                        );
                        
                        // 当前位置
                        positions.push(v.x, v.y, v.z);
                        
                        // 随机目标位置（分散效果）- 缩小活动范围
                        const randomTarget = new THREE.Vector3(
                            v.x + (Math.random() - 0.5) * 3,  // 从10改为3
                            v.y + (Math.random() - 0.5) * 3,  // 从10改为3
                            v.z + (Math.random() - 0.5) * 3   // 从10改为3
                        );
                        
                        targets.push(randomTarget.x, randomTarget.y, randomTarget.z);
                        
                        // 随机颜色
                        const color = new THREE.Color(Math.random(), Math.random(), Math.random());
                        colors.push(color.r, color.g, color.b);
                    }
                }
            }
        });
        
        if (positions.length === 0) return; // 如果没有顶点，直接返回
        
        // 创建粒子系统
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('target', new THREE.Float32BufferAttribute(targets, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        
        const material = new THREE.PointsMaterial({
            size: 0.03,
            vertexColors: true,
            transparent: true,
            opacity: 0.1, // 添加透明度
            blending: THREE.NormalBlending,
            depthTest: false,
            sizeAttenuation: true
        });
        
        const particles = new THREE.Points(geometry, material);
        this.scene.add(particles);
        
        // 保存粒子系统以便后续动画
        const particleSystem = {
            object: particles,
            originalBuilding: building,
            type: 'disintegration',
            buildingIndex: buildingIndex,
            progress: 0,
            totalDuration: 800,
            startTime: Date.now()
        };
        
        this.particleSystems.push(particleSystem);
        
        // 开始分解动画
        this.animateDisintegration(particleSystem);
    }
    
    createReconstructionEffect(targetBuilding, buildingIndex, originalBuilding) {
        // 创建新建筑的粒子聚合特效
        if (!targetBuilding) return;
        
        // 创建从随机位置到目标位置的粒子
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const targets = [];
        const colors = [];
        
        // 从目标建筑中提取顶点作为目标位置
        targetBuilding.updateMatrixWorld();
        targetBuilding.traverse((child) => {
            if (child.isMesh) {
                const meshGeometry = child.geometry.clone();
                meshGeometry.applyMatrix4(child.matrixWorld);
                
                const posAttribute = meshGeometry.getAttribute('position');
                if(posAttribute) {
                    for (let i = 0; i < posAttribute.count; i++) {
                        const v = new THREE.Vector3(
                            posAttribute.getX(i),
                            posAttribute.getY(i),
                            posAttribute.getZ(i)
                        );
                        
                        // 随机起始位置 - 缩小活动范围
                        const randomPos = new THREE.Vector3(
                            v.x + (Math.random() - 0.5) * 3,  // 从10改为3
                            v.y + (Math.random() - 0.5) * 3,  // 从10改为3
                            v.z + (Math.random() - 0.5) * 3   // 从10改为3
                        );
                        
                        positions.push(randomPos.x, randomPos.y, randomPos.z);
                        targets.push(v.x, v.y, v.z);
                        
                        // 随机颜色
                        const color = new THREE.Color(Math.random(), Math.random(), Math.random());
                        colors.push(color.r, color.g, color.b);
                    }
                }
            }
        });
        
        if (positions.length === 0) return; // 如果没有顶点，直接返回
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('target', new THREE.Float32BufferAttribute(targets, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        
        const material = new THREE.PointsMaterial({
            size: 0.03,
            vertexColors: true,
            transparent: true,
            opacity: 0.1, // 添加透明度
            blending: THREE.AdditiveBlending,
            depthTest: false,
            sizeAttenuation: true
        });
        
        const particles = new THREE.Points(geometry, material);
        this.scene.add(particles);
        
        // 保存粒子系统
        const particleSystem = {
            object: particles,
            targetBuilding: targetBuilding,
            originalBuilding: originalBuilding,
            type: 'reconstruction',
            buildingIndex: buildingIndex,
            progress: 0,
            totalDuration: 800,
            startTime: Date.now()
        };
        
        this.particleSystems.push(particleSystem);
        
        // 开始聚合动画
        this.animateReconstruction(particleSystem);
    }
    
    animateDisintegration(particleSystem) {
        const animate = () => {
            if (!this.particleSystems.includes(particleSystem)) {
                return; // 粒子系统已被移除
            }
            
            const elapsed = Date.now() - particleSystem.startTime;
            const progress = Math.min(elapsed / particleSystem.totalDuration, 1);
            
            // 更新粒子位置，使其向目标位置移动（分散）
            const positions = particleSystem.object.geometry.attributes.position.array;
            const targets = particleSystem.object.geometry.attributes.target.array;
            
            for (let i = 0; i < positions.length; i += 3) {
                // 根据进度逐渐向目标位置移动
                positions[i] = positions[i] + (targets[i] - positions[i]) * 0.05;
                positions[i+1] = positions[i+1] + (targets[i+1] - positions[i+1]) * 0.05;
                positions[i+2] = positions[i+2] + (targets[i+2] - positions[i+2]) * 0.05;
            }
            
            particleSystem.object.geometry.attributes.position.needsUpdate = true;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // 动画完成，移除粒子
                this.scene.remove(particleSystem.object);
                
                // 从粒子系统列表中移除
                const index = this.particleSystems.indexOf(particleSystem);
                if (index > -1) {
                    this.particleSystems.splice(index, 1);
                }
            }
        };
        
        animate();
    }
    
    animateReconstruction(particleSystem) {
        const animate = () => {
            if (!this.particleSystems.includes(particleSystem)) {
                return; // 粒子系统已被移除
            }
            
            const elapsed = Date.now() - particleSystem.startTime;
            const progress = Math.min(elapsed / particleSystem.totalDuration, 1);
            
            // 更新粒子位置，使其向目标位置移动
            const positions = particleSystem.object.geometry.attributes.position.array;
            const targets = particleSystem.object.geometry.attributes.target.array;
            
            for (let i = 0; i < positions.length; i += 3) {
                // 根据进度逐渐向目标位置移动
                positions[i] = positions[i] + (targets[i] - positions[i]) * 0.05;
                positions[i+1] = positions[i+1] + (targets[i+1] - positions[i+1]) * 0.05;
                positions[i+2] = positions[i+2] + (targets[i+2] - positions[i+2]) * 0.05;
            }
            
            particleSystem.object.geometry.attributes.position.needsUpdate = true;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // 动画完成，显示新建筑并移除粒子
                if (particleSystem.targetBuilding) {
                    particleSystem.targetBuilding.visible = true;
                }
                
                this.scene.remove(particleSystem.object);
                
                // 从粒子系统列表中移除
                const index = this.particleSystems.indexOf(particleSystem);
                if (index > -1) {
                    this.particleSystems.splice(index, 1);
                }
                
                // 如果有原始建筑，确保它是不可见的
                if (particleSystem.originalBuilding) {
                    particleSystem.originalBuilding.visible = false;
                }
            }
        };
        
        animate();
    }
    
    update() {
        // 更新所有活动的粒子系统
        for (const ps of this.particleSystems) {
            // 可以在这里添加额外的更新逻辑
        }
    }
}