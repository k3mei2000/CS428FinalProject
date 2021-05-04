import * as THREE from '../js/three.module.js';
import {OrbitControls} from '../js/OrbitControls.js';
import {GLTFLoader} from '../js/GLTFLoader.js';
import {BufferGeometryUtils} from '../js/BufferGeometryUtils.js';
import * as dat from '../js/dat.gui.module.js';

let renderer, scene, camera, raycaster, light, mixer;
let animations = new Map();
let models = new Map();
let clock = new THREE.Clock();

let water, land, assets, blueprint;
let overlay, gridHelper, gridCursor;

/*
-------------------------------------
General code to setup the environment
-------------------------------------
*/
const canvas = document.querySelector('#c');
renderer = new THREE.WebGLRenderer({canvas});
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.shadowMap.enabled = true;
renderer.shadowMapSoft = true;
document.body.appendChild( renderer.domElement );

scene = new THREE.Scene();

let aspect = window.innerWidth / window.innerHeight;
let cameraDist = 40;
camera = new THREE.PerspectiveCamera(cameraDist, aspect, 1, 1000 );
camera.position.set(-cameraDist, cameraDist, -cameraDist);
camera.lookAt( 0,0,0 );
/*
const helper = new THREE.CameraHelper(camera);
scene.add(helper);

const axesHelper = new THREE.AxesHelper(200);
scene.add(axesHelper);
*/


raycaster = new THREE.Raycaster();

/*
-----------
GUI Methods
-----------
*/

let dimensionController, modeController, actionController, elementsList;

let gui = new dat.GUI();

let dimension = {Dimension: 40};
dimensionController = gui.add(dimension, 'Dimension', 20, 60, 4);
dimensionController.onFinishChange(resizeBoard);
let mode = {Edit: false};
modeController = gui.add(mode, 'Edit');
modeController.onChange(switchModes);
let action = {Action: 'Add'};
let element = {Element: 'Tree'};


function switchModes() {
    if (mode.Edit) {
        actionController = gui.add(action, 'Action', ['Add', 'Remove']);
        actionController.onChange(toggleAction);
        if (action.Action == 'Add') {
            elementsList = gui.add(element, 'Element', ['Tree', 'Rock', 'Water']);
            elementsList.onChange(toggleElement);
        }
        addEditModeFeatures();
        
        
    } else {
        if (actionController) {
            gui.remove(actionController);
        }
        if (elementsList) {
            gui.remove(elementsList);
        }
        removeEditModeFeatures();
    }
}

function toggleAction() {
    if (action.Action == 'Add') {
        elementsList = gui.add(element, 'Element', ['Tree', 'Rock', 'Water']);
        elementsList.onChange(toggleElement);
        toggleElement();
    } else {
        initGridCursor(1, 0xff0000);
        if (elementsList) {
            gui.remove(elementsList);
        }
        elementsList = undefined;
    }
}

function toggleElement() {
    let elementValue = convertTextToElements(element.Element);

    if (gridCursor) {
        scene.remove(gridCursor);
    }
    switch (elementValue) {
        case elements.TREE:
        case elements.ROCK:
            initGridCursor(2, 0xff0000);
            break;
        case elements.WATER:
            initGridCursor(1, 0xff0000);
            break;
    }
}

function resizeBoard() {
    if (dim != dimension.Dimension) {
        clearScene();
        dim = dimension.Dimension;
        addToScene();
    }
    
}

function addEditModeFeatures() {
    scene.add(overlay);
    scene.add(gridHelper);
    document.addEventListener('pointermove', onPointerMove);
}

function removeEditModeFeatures() {
    scene.remove(overlay);
    scene.remove(gridHelper);
    scene.remove(gridCursor);
    document.removeEventListener('pointermove', onPointerMove);
}

function clearScene() {
    scene.remove(base);
    scene.remove(land);
    scene.remove(water);
    scene.remove(gridHelper);
    for (let i = 0; i < dim; i++) {
        for (let j = 0; j < dim; j++) {
            let asset = assets[i][j];
            if (asset != null && asset.parent == scene) {
                scene.remove(asset);
            }
        }
    }
}

function addToScene() {
    controls.target.set(dim / 2, 0, dim / 2);
    camera.lookAt(dim/2, 0, dim/2);
    let geometry = new THREE.BoxGeometry(dim, 2, dim);
    base = new THREE.Mesh(geometry, landMaterial);
    base.receiveShadow = true;
    base.position.x = dim / 2;
    base.position.y = -1.5 * geometry.parameters.height;
    base.position.z = dim / 2;
    scene.add(base);

    assets = new Array(dim);
    for (let i = 0; i < dim; i++) {
        assets[i] = new Array(dim);
        for (let j = 0; j < dim; j++) {
            assets[i][j] = null;
        }
    }
    blueprint = new Array(dim);
    for (let i = 0; i < dim; i++) {
        blueprint[i] = new Array(dim);
        for (let j = 0; j < dim; j++) {
            blueprint[i][j] = elements.LAND;
        }
    }

    generateSampleBlueprint(dim);
    addObjectsFromBlueprint(scene, blueprint);

    initOverlay(); 

    if (mode.Edit) {
        scene.add(overlay);
        scene.add(gridHelper);
    }
}


/*
----------------------
Lighting Configuration
----------------------
*/

const dayColor = 0xFFFFFF;
const nightColor = 0xdde3eb;
const dayIntensity = 1;
const nightIntensity = 0.6;
const daylight = new THREE.DirectionalLight(dayColor, dayIntensity);
const nightlight = new THREE.DirectionalLight(nightColor, nightIntensity);

configureLight(daylight);
configureLight(nightlight);

daylight.position.set(-50,60,20);
nightlight.position.set(40,60,-40);

let isDaytime = true;
light = daylight;
changeToDay();


const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

// Functions for this section:
function configureLight(light) {
    const d = 50;
    light.castShadow = true;
    light.shadow.camera.near = 0;
    light.shadow.camera.far = 500;
    light.shadow.camera.left = -d;
    light.shadow.camera.right = d;
    light.shadow.camera.top = d;
    light.shadow.camera.bottom = -d;
    light.shadow.mapSize.width = 4096;
    light.shadow.mapSize.height = 4096;
}

/*
-----------------------------
Loading and Setting up Meshes
-----------------------------
*/

await loadModels();

let landMaterial = new THREE.MeshPhongMaterial({color: 0x44aa88});
let dim = 40;
let geometry = new THREE.BoxGeometry(dim, 2, dim);
let base = new THREE.Mesh(geometry, landMaterial);
base.receiveShadow = true;
base.position.x = dim / 2;
base.position.y = -1.5 * geometry.parameters.height;
base.position.z = dim / 2;
scene.add(base);


const elements = {
    LAND: 0,
    WATER: 1,
    TREE: 2,
    ROCK: 3,
    FILLER: 4,
}

function convertTextToElements(text) {
    let element = null;
    if (text === 'Land') {
        element = elements.LAND;
    } else if (text === 'Water') {
        element = elements.WATER;
    } else if (text === 'Tree') {
        element = elements.TREE;
    } else if (text === 'Rock') {
        element = elements.ROCK;
    }
    return element;
}

assets = new Array(dim);
for (let i = 0; i < dim; i++) {
    assets[i] = new Array(dim);
    for (let j = 0; j < dim; j++) {
        assets[i][j] = null;
    }
}
blueprint = new Array(dim);
for (let i = 0; i < dim; i++) {
    blueprint[i] = new Array(dim);
    for (let j = 0; j < dim; j++) {
        blueprint[i][j] = elements.LAND;
    }
}

generateSampleBlueprint(dim);
addObjectsFromBlueprint(scene, blueprint);

initOverlay(); 
initGridCursor(2, 0xff0000);



// Functions for this section:
async function loadModels() {
    const loader = new GLTFLoader();

    const [treeData, rockData] = await Promise.all([
        loader.loadAsync("./assets/tree.glb"),
        loader.loadAsync("./assets/rock.glb"),
    ]);

    treeData.scene.children[2].children[0].castShadow = true;
    //treeData.scene.children[2].children[0].receiveShadow = true;

    treeData.scene.children[2].children[1].castShadow = true;
    //treeData.scene.children[2].children[1].receiveShadow = true;

    rockData.scene.children[2].castShadow = true;
    //rockData.scene.children[2].receiveShadow = true;


    models.set("Tree", treeData.scene.children[2]);
    models.set("Rock", rockData.scene.children[2]);

    animations.set("Tree", treeData.animations);
    
}



function generateSampleBlueprint(dim) {

    let i = Math.floor(Math.random() * 4);
    if (i == 0) {
        generateRiverBlueprint(dim);
    } else if (i == 1) {
        generateIslandBlueprint(dim);
    } else if (i == 2) {
        generateLakeBlueprint(dim);
    } else {
        generatePuddlesBlueprint(dim);
    }
    
}

function generateRiverBlueprint(dim) {
    for (let i = 0; i < dim; i++) {
        for (let j = 0; j < dim; j++) {
            if (j >= Math.floor(0.5 * dim) && j < Math.floor(0.75*dim)) {
                blueprint[i][j] = elements.WATER;
            } else if ( i >= Math.floor(0.5 * dim) && ((i % 8 == 0 && j % 4 == 2) || (i % 8 == 4 && j % 4 == 0)) ) {
                if (canAdd(i,j,2)) {
                    addTreeToBlueprint(i,j);
                }
            }
        }
    }

    for (let i = 0; i < Math.floor(0.5*dim); i++) {
        let r = Math.floor(Math.random() * Math.floor(0.5*dim));
        let c = Math.floor(Math.random() * dim);

        if (canAdd(r,c,2)) {
            addRockToBlueprint(r,c);
        }
    }
}

function generateIslandBlueprint(dim) {
    for (let i = 0; i < dim; i++) {
        for (let j = 0; j < dim; j++) {
            blueprint[i][j] = elements.WATER;
        }
    }

    for (let i = Math.floor(0.125 * dim); i < Math.floor(0.875 * dim); i++) {
        for (let j = Math.floor(0.125 * dim); j < Math.floor(0.875 * dim); j++) {
            blueprint[i][j] = elements.LAND;
        }
    }

    for (let i = 0; i < dim; i++) {
        let r = Math.floor(Math.random() * dim);
        let c = Math.floor(Math.random() * dim);

        if (canAdd(r,c,2)) {
            addTreeToBlueprint(r,c);
        }
    } 

    for (let i = 0; i < Math.floor(0.5*dim); i++) {
        let r = Math.floor(Math.random() * dim);
        let c = Math.floor(Math.random() * dim);

        if (canAdd(r,c,2)) {
            addRockToBlueprint(r,c);
        }
    } 
}

function generateLakeBlueprint(dim) {
    for (let i = Math.floor(0.25 * dim); i < Math.floor(0.75 * dim); i++) {
        for (let j = Math.floor(0.25 * dim); j < Math.floor(0.75 * dim); j++) {
            blueprint[i][j] = elements.WATER;
        }
    }
    
    for (let i = 0; i < dim; i++) {
        let r = Math.floor(Math.random() * dim);
        let c = Math.floor(Math.random() * dim);

        if (canAdd(r,c,2)) {
            addTreeToBlueprint(r,c);
        }
    } 

    for (let i = 0; i < Math.floor(0.5*dim); i++) {
        let r = Math.floor(Math.random() * dim);
        let c = Math.floor(Math.random() * dim);

        if (canAdd(r,c,2)) {
            addRockToBlueprint(r,c);
        }
    }
}

function generatePuddlesBlueprint(dim) {
    for (let i = 0; i < dim + 20; i++) {
        let r = Math.floor(Math.random() * dim);
        let c = Math.floor(Math.random() * dim);

        let range = Math.floor(Math.random() * 5) + 1;
        if (canAdd(r,c,range)) {
            for (let x = 0; x < range; x++) {
                for (let y = 0; y < range; y++) {
                    blueprint[r+x][c+y] = elements.WATER;
                }
            }
        }
    }

    for (let i = 0; i < dim; i++) {
        let r = Math.floor(Math.random() * dim);
        let c = Math.floor(Math.random() * dim);

        if (canAdd(r,c,2)) {
            addTreeToBlueprint(r,c);
        }
    } 

    for (let i = 0; i < Math.floor(0.5*dim); i++) {
        let r = Math.floor(Math.random() * dim);
        let c = Math.floor(Math.random() * dim);

        if (canAdd(r,c,2)) {
            addRockToBlueprint(r,c);
        }
    }
}

function addObjectsFromBlueprint(scene, blueprint) {
    let dim = blueprint.length;
    
    fillTerrain(scene, blueprint);
    
    for (let i = 0; i < dim; i++) {
        for (let j = 0; j < dim; j++) {
            
            if (blueprint[i][j] == elements.TREE) {
                addTree(i,j);
            } else if (blueprint[i][j] == elements.ROCK) {
                addRock(i,j);
            }        
            
        }
    }
    
    
}

function addTreeToBlueprint(i,j) {
    blueprint[i][j] = elements.TREE;
    blueprint[i+1][j] = elements.FILLER;
    blueprint[i][j+1] = elements.FILLER;
    blueprint[i+1][j+1] = elements.FILLER;
}

function addRockToBlueprint(i,j) {
    blueprint[i][j] = elements.ROCK;
    blueprint[i+1][j] = elements.FILLER;
    blueprint[i][j+1] = elements.FILLER;
    blueprint[i+1][j+1] = elements.FILLER;
}

function addTree(i, j) {
    let tree = models.get("Tree").clone();
    tree.position.set(i+1,0,j+1);
    tree.rotateY(THREE.MathUtils.randFloat(0, 2*Math.PI));
    tree.name = 'Tree';
    scene.add(tree);

    assets[i][j] = tree;
    assets[i+1][j] = tree;
    assets[i][j+1] = tree;
    assets[i+1][j+1] = tree;
}

function addRock(i, j) {
    let rock = models.get("Rock").clone();
    rock.position.set(i+1,0,j+1);
    rock.rotateY(THREE.MathUtils.randFloat(0, 2*Math.PI));
    rock.scale.set(Math.random() * 0.4 + 0.7, Math.random() * 0.4 + 0.7, Math.random() * 0.4 + 0.7);
    scene.add(rock);

    assets[i][j] = rock;
    assets[i+1][j] = rock;
    assets[i][j+1] = rock;
    assets[i+1][j+1] = rock;
}

function fillTerrain(scene, blueprint) {

    if (water) {
        scene.remove(water);
    }
    if (land) {
        scene.remove(land);
    }

    let waterGeometries = [];
    let landGeometries = [];

    let waterGeometry = new THREE.PlaneGeometry(1, 1);
    let waterSideGeometry = new THREE.PlaneGeometry(1, 1.8);
    let landGeometry = new THREE.BoxGeometry(1, 2, 1);

    const waterMaterial = new THREE.MeshPhongMaterial({color: 0x006dcc, opacity: 0.75, transparent: true, side: THREE.DoubleSide});
    for (let i = 0; i < dim; i++) {
        for (let j = 0; j < dim; j++) {
            
            if (blueprint[i][j] == elements.WATER) {
                
                if (i == 0) {
                    let wgClone = waterSideGeometry.clone();
                    wgClone.rotateY(Math.PI/2);
                    wgClone.translate(i, -1.1, j + .5);
                    waterGeometries.push(wgClone);

                } else if (i == dim-1) {
                    let wgClone = waterSideGeometry.clone();
                    wgClone.rotateY(-Math.PI/2);
                    wgClone.translate(i + 1, -1.1, j + .5);
                    waterGeometries.push(wgClone);
                } 

                if (j == 0) {
                    let wgClone = waterSideGeometry.clone();
                    wgClone.translate(i + .5, -1.1, j);
                    waterGeometries.push(wgClone);
                } else if (j == dim-1) {
                    let wgClone = waterSideGeometry.clone();
                    wgClone.translate(i + .5, -1.1, j+1);
                    waterGeometries.push(wgClone);
                }

                let wgClone = waterGeometry.clone();
                wgClone.rotateX(-Math.PI/2);
                wgClone.translate(i+.5, -0.2, j+.5);
                waterGeometries.push(wgClone);
                
                
            } else {
                
                let lgClone = landGeometry.clone();
                lgClone.translate(i + .5, -1, j + .5);
                landGeometries.push(lgClone);

            }
        }
    }

    if (waterGeometries.length > 0) {
        let mergedWaterGeometry = BufferGeometryUtils.mergeBufferGeometries(waterGeometries, false);
        water = new THREE.Mesh(mergedWaterGeometry, waterMaterial);
        //water.receiveShadow = true;
        scene.add(water);
    }
    
    if (landGeometries.length > 0) {
        let mergedLandGeometry = BufferGeometryUtils.mergeBufferGeometries(landGeometries, false);
        land = new THREE.Mesh(mergedLandGeometry, landMaterial);
        land.receiveShadow = true;
        scene.add(land);
    }
    
}

function initOverlay() {
    
    if (overlay) {
        overlay = null;
    }
    let gridGeometry = new THREE.PlaneGeometry(1, 1);
    let gridMaterial = new THREE.MeshBasicMaterial( {color: 0xffffff, opacity: 0, transparent: true, depthWrite: false});
    gridGeometry.rotateX(-Math.PI/2);
    

    let gridGeometries = [];

    for (let i = 0; i < dim; i++) {
        for (let j = 0; j < dim; j++) {
            let gClone = gridGeometry.clone();
            gClone.translate(i+0.5, 0.01, j+0.5);
            gridGeometries.push(gClone);
        }
    }

    let mergedOverlayGeometry = BufferGeometryUtils.mergeBufferGeometries(gridGeometries, false);

    overlay = new THREE.Mesh(mergedOverlayGeometry, gridMaterial);

    gridHelper = new THREE.GridHelper( dim, dim);
    gridHelper.position.set(dim/2, 0.01, dim/2);
}

function initGridCursor(range, colorValue) {
    let gridGeometry = new THREE.PlaneGeometry(range, range);
    let gridCursorMaterial = new THREE.MeshBasicMaterial( {color: colorValue, opacity: 0.75, transparent: true});
    gridGeometry.rotateX(-Math.PI/2);
    gridGeometry.translate(0,0.02,0);
    gridCursor = new THREE.Mesh( gridGeometry, gridCursorMaterial);
}




/*
-----------------------
Enabling Interactivity:

Camera~
-Hold left click and move mouse to rotate around the center of the screen.
-Scroll to zoom relative to the center of screen.
-Hold shift and left click to translate the scene.

Other~
-Click a tree or rock to see a small animation.
-Press the spacebar to toggle between daytime and nighttime.
------------------------
*/


const controls = new OrbitControls(camera, canvas);
controls.target.set(dim / 2, 0, dim / 2);
controls.update();

const pickPosition = {x: -100000, y: -100000};


document.addEventListener('pointerdown', onPointerDown);
document.addEventListener('keydown', onKeyDown);


//Functions for this section:
function onPointerMove(event) {
    setPickPosition(event);

    raycaster.setFromCamera(pickPosition, camera);

    const intersects = raycaster.intersectObjects([overlay]);
    if ( intersects.length > 0 ) {
        const intersect = intersects[0];
        
        if (gridCursor.parent != scene) {
            scene.add(gridCursor);
        }

        if (action.Action == 'Add') {
            let elementValue = convertTextToElements(element.Element);
            switch (elementValue) {
                case elements.TREE:
                case elements.ROCK:
                    gridCursor.position.x = roundWithOffset(intersect.point.x, 1);
                    gridCursor.position.z = roundWithOffset(intersect.point.z, 1);

                    if (Math.floor(intersect.point.x) >= dim - 1 || Math.floor(intersect.point.z) >= dim - 1) {
                        scene.remove(gridCursor);
                    }
                    if (canAdd(Math.floor(intersect.point.x),Math.floor(intersect.point.z),2)) {
                        gridCursor.material.color.setHex(0x00FF00);
                    } else {
                        gridCursor.material.color.setHex(0xFF0000);
                    }
                    break;
                case elements.WATER:
                    gridCursor.position.x = roundWithOffset(intersect.point.x, 0.5);
                    gridCursor.position.z = roundWithOffset(intersect.point.z, 0.5);

                    if (canAdd(Math.floor(intersect.point.x), Math.floor(intersect.point.z), 1)) {
                        gridCursor.material.color.setHex(0x00FF00);
                    } else {
                        gridCursor.material.color.setHex(0xFF0000);
                    }
                    break;
            } 
        } else {
            gridCursor.position.x = roundWithOffset(intersect.point.x, 0.5);
            gridCursor.position.z = roundWithOffset(intersect.point.z, 0.5);

            if (blueprint[Math.floor(intersect.point.x)][Math.floor(intersect.point.z)] != elements.LAND) {
                gridCursor.material.color.setHex(0x00FF00);
            } else {
                gridCursor.material.color.setHex(0xFF0000);
            }
        }
    
    } else {
        if (gridCursor.parent == scene) {
            scene.remove(gridCursor);
        }
    }
}

function roundWithOffset(x, offset) {
    return Math.floor(x) + offset;
}

function setPickPosition(event) {
    pickPosition.x = ( event.clientX / renderer.domElement.clientWidth ) * 2 - 1;
    pickPosition.y = ( event.clientY / renderer.domElement.clientHeight ) * -2 + 1;
}


function onPointerDown( event ) {
    setPickPosition(event);
    if (mode.Edit) {
        editTerrain(pickPosition);
    } else {
        interact(pickPosition, scene, camera);
    }
}

function interact(position, scene, camera) {

    raycaster.setFromCamera(position, camera);
    const intersectedObjects = raycaster.intersectObjects(scene.children, true);

    if (intersectedObjects.length) {
        
        let pickedObject = intersectedObjects[0].object;

        if (pickedObject.parent.name == "Tree") {
            pickedObject = pickedObject.parent;
        }
            
        playAnimation(pickedObject);
    } 

}

function playAnimation(object) {
    if (typeof mixer !== "undefined") {
        mixer.stopAllAction();
    }
    mixer = new THREE.AnimationMixer(object);
    if (object.name === "Tree") {
        const clip = THREE.AnimationClip.findByName( animations.get("Tree"), 'Shake');
        let action = mixer.clipAction( clip );
        
        action.setLoop(THREE.LoopOnce);
        action.reset();
        action.play();
    } else if (object.name === "Rock") {
    
        let times = [0,0.2,0.3,0.4, 0.6];
        let positions = [object.position.y, object.position.y + 3, object.position.y + 4, object.position.y + 3, object.position.y];
        let posTrack = new THREE.VectorKeyframeTrack('.position[y]', times, positions);
        const clip = new THREE.AnimationClip(null, 0.6, [posTrack], THREE.InterpolateSmooth);
        let action = mixer.clipAction( clip );

        action.setLoop(THREE.LoopOnce);
        action.reset();
        action.play();
    }

}

function editTerrain(pickPosition) {
    raycaster.setFromCamera(pickPosition, camera);

    const intersects = raycaster.intersectObjects([overlay]);
    if ( intersects.length > 0 ) {
        const intersect = intersects[0];
        
        let i = Math.floor(intersect.point.x);
        let j = Math.floor(intersect.point.z);

        if (action.Action == 'Add') {
            let elementValue = convertTextToElements(element.Element);
            switch (elementValue) {
                case elements.TREE:
                    if (canAdd(i,j,2)) {
                        addTreeToBlueprint(i,j);
                        addTree(i,j);
                    }
                    break;
                case elements.ROCK:
                    if (canAdd(i,j,2)) {
                        addRockToBlueprint(i,j);
                        addRock(i,j);
                    }
                    break;
                case elements.WATER:
                    if (canAdd(i,j,1)) {
                        blueprint[i][j] = elements.WATER;
                        fillTerrain(scene,blueprint);
                    }
                    break;
            }
            gridCursor.material.color.setHex(0xFF0000);
            
        } else {
            if (blueprint[i][j] != elements.LAND) {
                if (assets[i][j] != null) {
                    scene.remove(assets[i][j]);

                    if (blueprint[i][j] == elements.FILLER) {
                        if (i - 1 >= 0 && (blueprint[i-1][j] == elements.TREE || blueprint[i-1][j] == elements.ROCK)) {
                            removeFromBlueprint(i-1,j,2);
                        } else if (j - 1 >= 0 && (blueprint[i][j-1] == elements.TREE || blueprint[i][j-1] == elements.ROCK)) {
                            removeFromBlueprint(i, j-1,2);
                        } else {
                            removeFromBlueprint(i-1,j-1,2);
                        }
                    } else {
                        removeFromBlueprint(i,j,2);
                    }
                    
                } else if (blueprint[i][j] == elements.WATER) {
                    blueprint[i][j] = elements.LAND;
                    fillTerrain(scene,blueprint);
                }
            }
            gridCursor.material.color.setHex(0xFF0000);
        }
    
    } 
}

function canAdd(i, j, range) {
    if (i + range - 1 >= dim || j + range - 1 >= dim) {
        return false;
    }
    for (let k = 0; k < range; k++) {
        for (let l = 0; l < range; l++) {
            if (blueprint[i+k][j+l] != elements.LAND) {
                return false;
            }
        }
    }
    return true;
}

function removeFromBlueprint(i,j, range) {
    for (let k = 0; k < range; k++) {
        for (let l = 0; l < range; l++) {
            blueprint[i+k][j+l] = elements.LAND;
        }
    }
}

function onKeyDown( event ) {
    
    if (event.key == " ") {
        event.preventDefault();
        if (isDaytime) {
            changeToNight();
        } else {
            changeToDay(); 
        }
        isDaytime = !isDaytime;
    }
}

function changeToDay() {
    scene.background = new THREE.Color(0x00ffff);
    scene.remove(light);
    light = daylight;
    scene.add(light);
}

function changeToNight() {
    scene.background = new THREE.Color(0x0c1445); 
    scene.remove(light);
    light = nightlight;
    scene.add(light);
}


/*
--------------
Rendering Loop
--------------
*/

animate();


function animate() {

    if (resizeRendererToDisplaySize(renderer)) {
        const canvas = renderer.domElement;
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
    }      
    if (typeof mixer !== "undefined") {
        mixer.update(clock.getDelta());
    }
    renderer.render( scene, camera );

    requestAnimationFrame( animate );
    
}


function resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
        renderer.setSize(width, height, false);
    }
    return needResize;
}

