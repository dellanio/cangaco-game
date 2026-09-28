import bpy
import json
import math
import os
from mathutils import Vector


PROJECT = os.environ.get("PIANCO_PROJECT_ROOT", os.getcwd())
ASSET = os.environ["PIANCO_ASSET"]
STATE = os.environ.get("PIANCO_STATE", "completo")


CONFIG = {
    "storehouse": {
        "blend": os.path.join(PROJECT, "assets", "source", "blender", "buildings", "storehouse.blend"),
        "root": "STOREHOUSE_ROOT",
        "prefix": "STOREHOUSE_",
        "z_scale": 0.68,
        "target_z": 1.42,
        "azimuth": 10.0,
        "elevation": 59.5051,
        "finished": (
            "STOREHOUSE_BOARD_BODY", "STOREHOUSE_LOADING_VOID", "STOREHOUSE_LOADING_DOOR",
            "STOREHOUSE_DOOR_BAR", "STOREHOUSE_LOFT_VOID", "STOREHOUSE_LOFT_DOOR",
            "STOREHOUSE_VENT", "STOREHOUSE_ROOF_FRONT", "STOREHOUSE_ROOF_BACK",
            "STOREHOUSE_RIDGE",
        ),
    },
    "quarry": {
        "blend": os.path.join(PROJECT, "assets", "source", "blender", "buildings", "quarry.blend"),
        "root": "TEST_QUARRY_ROOT",
        "prefix": "TEST_QUARRY_",
        "z_scale": 0.76,
        "target_z": 0.82,
        "azimuth": 20.0,
        "elevation": 63.2080,
        "finished": (
            "TEST_QUARRY_SIDE_WALL", "TEST_QUARRY_BACK_WALL", "TEST_QUARRY_ZINC_ROOF",
            "TEST_QUARRY_DRUM", "TEST_QUARRY_ROPE", "TEST_QUARRY_HOOK",
        ),
    },
}


def material(name, color, roughness=0.92, metallic=0.0):
    value = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    value.use_nodes = True
    shader = next(node for node in value.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    return value


def block(root, name, dimensions, location, mat, rotation=(0.0, 0.0, 0.0)):
    old = bpy.data.objects.get(name)
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    obj.parent = root
    bevel = obj.modifiers.new("EDGE_SOFTENING", "BEVEL")
    bevel.width = 0.018
    bevel.segments = 2
    return obj


def add_storehouse_structure(root):
    wood = material("STOREHOUSE_CONSTRUCTION_WOOD", (0.33, 0.14, 0.045, 1.0))
    for x in (-1.18, -0.58, 0.0, 0.58, 1.18):
        block(root, f"STOREHOUSE_CONSTRUCTION_RAFTER_FRONT_{x:+.2f}",
              (0.10, 1.12, 0.10), (x, -0.43, 4.00), wood,
              (math.radians(20), 0.0, 0.0))
        block(root, f"STOREHOUSE_CONSTRUCTION_RAFTER_BACK_{x:+.2f}",
              (0.10, 1.12, 0.10), (x, 0.43, 4.00), wood,
              (math.radians(-20), 0.0, 0.0))
    for x in (-1.18, 1.18):
        for y in (-1.08, 1.08):
            block(root, f"STOREHOUSE_CONSTRUCTION_POST_{x:+.2f}_{y:+.2f}",
                  (0.14, 0.14, 3.35), (x, y, 2.02), wood)
    for y in (-1.08, 1.08):
        for z in (0.48, 2.02, 3.58):
            block(root, f"STOREHOUSE_CONSTRUCTION_BEAM_{y:+.2f}_{z:.2f}",
                  (2.52, 0.14, 0.14), (0.0, y, z), wood)
    for x in (-1.18, 1.18):
        block(root, f"STOREHOUSE_CONSTRUCTION_SIDE_BRACE_{x:+.2f}",
              (0.13, 2.30, 0.13), (x, 0.0, 2.00), wood,
              (0.0, math.radians(-31 if x < 0 else 31), 0.0))


def add_quarry_structure(root):
    wood = material("QUARRY_CONSTRUCTION_WOOD", (0.32, 0.13, 0.04, 1.0))
    for x in (-1.20, 1.20):
        for y in (-0.68, 0.68):
            block(root, f"TEST_QUARRY_CONSTRUCTION_POST_{x:+.2f}_{y:+.2f}",
                  (0.13, 0.13, 1.18), (x, y, 0.68), wood)
    for y in (-0.68, 0.68):
        block(root, f"TEST_QUARRY_CONSTRUCTION_BEAM_{y:+.2f}",
              (2.54, 0.13, 0.13), (0.0, y, 1.24), wood)
    for x in (-1.20, 1.20):
        block(root, f"TEST_QUARRY_CONSTRUCTION_BRACE_{x:+.2f}",
              (0.11, 1.56, 0.11), (x, 0.0, 0.70), wood,
              (math.radians(28 if x < 0 else -28), 0.0, 0.0))
    for x in (-0.62, 0.62):
        block(root, f"TEST_QUARRY_CONSTRUCTION_WINCH_BRACE_{x:+.2f}",
              (0.10, 0.10, 1.76), (x, -0.08, 1.14), wood,
              (0.0, math.radians(18 if x < 0 else -18), 0.0))


def set_camera(config):
    camera = bpy.data.objects["CAMERA_REFERENCE_PIANGO"]
    target = Vector((0.0, 0.0, config["target_z"]))
    azimuth = math.radians(config["azimuth"])
    elevation = math.radians(config["elevation"])
    direction = Vector((
        math.sin(azimuth) * math.cos(elevation),
        math.cos(azimuth) * math.cos(elevation),
        -math.sin(elevation),
    ))
    camera.location = target - direction * 20.0
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 8.0
    bpy.context.scene.camera = camera


def prepare_asset(config):
    root = bpy.data.objects[config["root"]]
    root.scale.z = config["z_scale"]
    root["vertical_compression"] = config["z_scale"]
    root["envelope_target"] = "ordinary <= 1.20 x footprint Y"
    already_applied = bool(root.get("compressed_rebuild_applied", False))

    for obj in bpy.context.scene.objects:
        belongs = obj == root or obj.parent == root
        if obj.type == "MESH":
            obj.hide_render = not belongs

    if not already_applied:
        # Shorten only protruding access/roof pieces; the base stays registered.
        for obj in bpy.context.scene.objects:
            if obj.parent != root:
                continue
            if "RAMP" in obj.name:
                obj.location.y *= 0.72
                obj.scale.y *= 0.72
            if ASSET == "storehouse" and "ROOF_" in obj.name:
                obj.location.y *= 0.62
                obj.scale.y *= 0.62

        if ASSET == "storehouse":
            add_storehouse_structure(root)
        else:
            add_quarry_structure(root)
        root["compressed_rebuild_applied"] = True

    for obj in bpy.context.scene.objects:
        if obj.parent != root:
            continue
        is_construction = "CONSTRUCTION_" in obj.name
        is_finished = any(obj.name.startswith(prefix) for prefix in config["finished"])
        if STATE == "madeira":
            obj.hide_render = is_finished
        else:
            obj.hide_render = is_construction

    return root


def render(config):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.view_settings.look = "AgX - Medium High Contrast"
    set_camera(config)
    bpy.context.view_layer.update()

    out_dir = os.path.join(PROJECT, "tmp", "blender", "compressed-rebuild", ASSET)
    os.makedirs(out_dir, exist_ok=True)
    output = os.path.join(out_dir, f"{ASSET}_{STATE}_render_1024.png")
    scene.render.filepath = output
    bpy.ops.render.render(write_still=True)
    blend = os.path.join(out_dir, f"{ASSET}_{STATE}_candidate.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    return output, blend


config = CONFIG[ASSET]
bpy.ops.wm.open_mainfile(filepath=config["blend"])
prepare_asset(config)
output, blend = render(config)
print(json.dumps({
    "asset": ASSET,
    "state": STATE,
    "render": output,
    "blend": blend,
    "verticalCompression": config["z_scale"],
    "camera": [config["azimuth"], config["elevation"]],
}, ensure_ascii=True))
