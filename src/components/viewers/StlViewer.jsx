import React, { useRef, useEffect, useState } from 'react';
import { X, Box, Grid3x3, Loader2, RotateCcw } from 'lucide-react';

/**
 * StlViewer — 3D STL file viewer using three.js
 * Supports URL or File object as source.
 * Lazy loaded via React.lazy().
 *
 * Props:
 *  - src: string (URL) or File object
 *  - onClose: function
 *  - embedded: boolean — if true, no close button (split view)
 */
export default function StlViewer({ src, onClose, embedded = false }) {
    const mountRef = useRef(null);
    const rendererRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const controlsRef = useRef(null);
    const animIdRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [wireframe, setWireframe] = useState(false);
    const meshRef = useRef(null);

    useEffect(() => {
        if (!src || !mountRef.current) return;

        let cancelled = false;
        setLoading(true);
        setError(null);

        async function init() {
            try {
                const THREE = await import('three');
                const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
                const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');

                if (cancelled || !mountRef.current) return;

                const container = mountRef.current;
                const width = container.clientWidth;
                const height = container.clientHeight;

                // Scene
                const scene = new THREE.Scene();
                scene.background = new THREE.Color(0x1e293b); // slate-800
                sceneRef.current = scene;

                // Camera
                const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
                camera.position.set(100, 100, 100);
                cameraRef.current = camera;

                // Renderer
                const renderer = new THREE.WebGLRenderer({ antialias: true });
                renderer.setSize(width, height);
                renderer.setPixelRatio(window.devicePixelRatio);
                renderer.shadowMap.enabled = true;
                container.appendChild(renderer.domElement);
                rendererRef.current = renderer;

                // Controls
                const controls = new OrbitControls(camera, renderer.domElement);
                controls.enableDamping = true;
                controls.dampingFactor = 0.08;
                controls.rotateSpeed = 0.8;
                controlsRef.current = controls;

                // Lights
                const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
                scene.add(ambientLight);

                const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
                directionalLight.position.set(100, 200, 100);
                directionalLight.castShadow = true;
                scene.add(directionalLight);

                const backLight = new THREE.DirectionalLight(0x6366f1, 0.3);
                backLight.position.set(-100, -50, -100);
                scene.add(backLight);

                // Grid
                const gridHelper = new THREE.GridHelper(200, 30, 0x334155, 0x1e293b);
                scene.add(gridHelper);

                // Axes (subtle)
                const axesHelper = new THREE.AxesHelper(50);
                axesHelper.material.opacity = 0.5;
                axesHelper.material.transparent = true;
                scene.add(axesHelper);

                // Load STL
                const loader = new STLLoader();

                let geometry;
                if (src instanceof File) {
                    const arrayBuffer = await src.arrayBuffer();
                    geometry = loader.parse(arrayBuffer);
                } else {
                    geometry = await new Promise((resolve, reject) => {
                        loader.load(src, resolve, undefined, reject);
                    });
                }

                if (cancelled) return;

                geometry.computeVertexNormals();
                
                // Center geometry
                geometry.computeBoundingBox();
                const center = new THREE.Vector3();
                geometry.boundingBox.getCenter(center);
                geometry.translate(-center.x, -center.y, -center.z);

                // Material
                const material = new THREE.MeshPhongMaterial({
                    color: 0x818cf8,     // indigo-400
                    specular: 0x6366f1,  // indigo-500
                    shininess: 60,
                    flatShading: false,
                });

                const mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                scene.add(mesh);
                meshRef.current = mesh;

                // Auto-fit camera
                const boundingBox = new THREE.Box3().setFromObject(mesh);
                const size = boundingBox.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const fov = camera.fov * (Math.PI / 180);
                let cameraZ = maxDim / (2 * Math.tan(fov / 2));
                cameraZ *= 1.8;
                camera.position.set(cameraZ * 0.7, cameraZ * 0.5, cameraZ * 0.7);
                camera.lookAt(0, 0, 0);
                controls.target.set(0, 0, 0);
                controls.update();

                // Animation loop
                function animate() {
                    animIdRef.current = requestAnimationFrame(animate);
                    controls.update();
                    renderer.render(scene, camera);
                }
                animate();

                // Handle resize
                const observer = new ResizeObserver(() => {
                    if (!container || !renderer) return;
                    const w = container.clientWidth;
                    const h = container.clientHeight;
                    camera.aspect = w / h;
                    camera.updateProjectionMatrix();
                    renderer.setSize(w, h);
                });
                observer.observe(container);

                setLoading(false);

                return () => {
                    observer.disconnect();
                };
            } catch (err) {
                console.error('[StlViewer] Error:', err);
                if (!cancelled) setError('Error al cargar el modelo 3D: ' + err.message);
                setLoading(false);
            }
        }

        init();

        return () => {
            cancelled = true;
            if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
            if (rendererRef.current && mountRef.current) {
                try { mountRef.current.removeChild(rendererRef.current.domElement); } catch {}
                rendererRef.current.dispose();
            }
        };
    }, [src]);

    // Toggle wireframe
    useEffect(() => {
        if (meshRef.current) {
            meshRef.current.material.wireframe = wireframe;
        }
    }, [wireframe]);

    const resetView = () => {
        if (controlsRef.current && cameraRef.current) {
            controlsRef.current.reset();
        }
    };

    const content = (
        <div className={`flex flex-col h-full ${embedded ? '' : 'bg-slate-900'}`}>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-800/80 border-b border-slate-700 shrink-0">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setWireframe(!wireframe)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            wireframe
                                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                : 'text-slate-400 hover:text-white hover:bg-slate-700 border border-transparent'
                        }`}
                        title="Toggle wireframe"
                    >
                        <Grid3x3 className="w-3.5 h-3.5" />
                        Wire
                    </button>
                    <button
                        onClick={resetView}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                        title="Reset view"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset
                    </button>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Box className="w-3.5 h-3.5" />
                    <span>Rotar: click + arrastrar</span>
                    <span className="text-slate-600">|</span>
                    <span>Zoom: scroll</span>
                </div>

                {!embedded && onClose && (
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* 3D Canvas */}
            <div ref={mountRef} className="flex-1 relative overflow-hidden">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-10">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                            <span className="text-sm text-slate-400 font-medium">Cargando modelo 3D...</span>
                        </div>
                    </div>
                )}
                {error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-10">
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                )}
            </div>
        </div>
    );

    if (embedded) return content;

    return (
        <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-5xl h-[85vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                {content}
            </div>
        </div>
    );
}
