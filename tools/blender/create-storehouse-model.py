import bpy
import json
import math
import os

from mathutils import Vector


scene = bpy.context.scene
project = globals().get("PIANCO_PROJECT_ROOT", os.path.abspath(os.getcwd()))
out = os.path.join(project, "tmp", "blender", "storehouse")
os.makedirs(out, exist_ok=True)


def material(name, color, roughness=0.9, metallic=0.0):
    value = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    value.use_nodes = True
    shader = next(n for n in value.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    return value


dark_wood = material("STOREHOUSE_DARK_BOARDS", (0.19, 0.07, 0.022, 1), 0.94)
mid_wood = material("STOREHOUSE_FRAME", (0.34, 0.14, 0.035, 1), 0.92)
roof = material("STOREHOUSE_TILE", (0.50, 0.12, 0.035, 1), 0.90)
stone = material("STOREHOUSE_STONE", (0.34, 0.30, 0.24, 1), 0.97)
iron = material("STOREHOUSE_IRON", (0.045, 0.04, 0.035, 1), 0.68, 0.48)
shadow = material("STOREHOUSE_OPENING", (0.018, 0.014, 0.010, 1), 0.82)

for obj in list(bpy.data.objects):
    if obj.name.startswith("STOREHOUSE_"):
        bpy.data.objects.remove(obj, do_unlink=True)

root = bpy.data.objects.new("STOREHOUSE_ROOT", None)
scene.collection.objects.link(root)
root.rotation_euler.z = math.radians(-10)
root["footprint_tiles"] = [3, 3]
root["view"] = "frontal"
root["camera"] = {"azimuth": 10.0, "elevation": 59.5051}


def block(name, dimensions, location, mat, bevel=0.025, rotation=None):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.dimensions = dimensions
    if rotation:
        obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    obj.parent = root
    if bevel:
        mod = obj.modifiers.new("EDGE_SOFTENING", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    if hasattr(obj, "visible_shadow"):
        obj.visible_shadow = False
    return obj


def cylinder(name, radius, depth, location, mat, rotation=(0, 0, 0), vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    obj.parent = root
    bevel = obj.modifiers.new("EDGE_SOFTENING", "BEVEL")
    bevel.width = 0.016
    bevel.segments = 2
    if hasattr(obj, "visible_shadow"):
        obj.visible_shadow = False
    return obj


# Two-storey warehouse mass, close to the Coronel height but deliberately non-residential.
block("STOREHOUSE_FOUNDATION", (2.84, 2.62, 0.38), (0, 0, 0.19), stone, 0.045)
block("STOREHOUSE_BOARD_BODY", (2.58, 2.38, 3.28), (0, 0, 2.02), dark_wood, 0.035)
for x in (-1.22, -0.62, 0.62, 1.22):
    block(f"STOREHOUSE_VERTICAL_FRAME_{x:+.2f}", (0.13, 0.13, 3.34), (x, -1.21, 2.03), mid_wood, 0.015)
for z in (0.48, 2.03, 3.62):
    block(f"STOREHOUSE_HORIZONTAL_FRAME_{z:.2f}", (2.62, 0.14, 0.15), (0, -1.22, z), mid_wood, 0.015)

# Monumental loading opening occupies roughly half the facade.
block("STOREHOUSE_LOADING_VOID", (1.40, 0.09, 2.20), (0, -1.285, 1.47), shadow, 0.012)
for index, x in enumerate((-0.35, 0.35)):
    block(f"STOREHOUSE_LOADING_DOOR_{index}", (0.67, 0.09, 2.12), (x, -1.34, 1.47), dark_wood, 0.015)
    for z in (0.78, 1.46, 2.14):
        block(f"STOREHOUSE_DOOR_BAR_{index}_{z:.2f}", (0.57, 0.035, 0.07), (x, -1.395, z), iron, 0.006)

# Upper floor is storage: one loft loading hatch and only narrow ventilation slits.
block("STOREHOUSE_LOFT_VOID", (0.92, 0.08, 0.78), (0, -1.28, 3.03), shadow, 0.012)
block("STOREHOUSE_LOFT_DOOR", (0.86, 0.08, 0.72), (0, -1.335, 3.03), mid_wood, 0.014)
for x in (-0.92, 0.92):
    block(f"STOREHOUSE_VENT_{x:+.2f}", (0.18, 0.07, 0.52), (x, -1.30, 3.02), shadow, 0.008)

# Raised loading platform and broad central ramp.
block("STOREHOUSE_PLATFORM", (2.48, 0.72, 0.18), (0, -1.47, 0.54), mid_wood, 0.025)
for x in (-1.12, -0.74, 0.74, 1.12):
    block(f"STOREHOUSE_PLATFORM_POST_{x:+.2f}", (0.13, 0.13, 0.52), (x, -1.56, 0.27), mid_wood, 0.016)
for step in range(4):
    depth = 0.30 + step * 0.16
    height = 0.10 * (step + 1)
    block(f"STOREHOUSE_RAMP_{step}", (1.30, depth, height), (0, -2.05 + step * 0.15, height / 2), stone, 0.018)

# Hoist breaks the eave line and tells the loading function even when empty.
for x in (-0.64, 0.64):
    block(f"STOREHOUSE_HOIST_POST_{x:+.2f}", (0.15, 0.15, 1.42), (x, -1.52, 3.66), mid_wood, 0.018)
block("STOREHOUSE_HOIST_TOP", (1.58, 0.18, 0.17), (0, -1.52, 4.32), mid_wood, 0.022)
cylinder("STOREHOUSE_HOIST_DRUM", 0.18, 0.66, (0.24, -1.55, 4.04), mid_wood, (0, math.radians(90), 0), 18)
cylinder("STOREHOUSE_HOIST_ROPE", 0.023, 0.88, (0.24, -1.55, 3.48), iron, (0, 0, 0), 10)
cylinder("STOREHOUSE_HOIST_HOOK", 0.07, 0.16, (0.24, -1.55, 3.00), iron, (0, 0, 0), 12)

# Broad two-slope roof with restrained pitch and wide eaves.
roof_angle = math.radians(20)
block("STOREHOUSE_ROOF_FRONT", (3.10, 1.64, 0.13), (0, -0.62, 4.00), roof, 0.028, (roof_angle, 0, 0))
block("STOREHOUSE_ROOF_BACK", (3.10, 1.64, 0.13), (0, 0.62, 4.00), roof, 0.028, (-roof_angle, 0, 0))
block("STOREHOUSE_RIDGE", (3.12, 0.15, 0.15), (0, 0, 4.29), roof, 0.035)

camera = bpy.data.objects["CAMERA_REFERENCE_PIANGO"]
target = Vector((0, 0, 1.75))
distance = 20.0
azimuth = math.radians(10.0)
elevation = math.radians(59.5051)
direction = Vector((math.sin(azimuth) * math.cos(elevation), math.cos(azimuth) * math.cos(elevation), -math.sin(elevation)))
camera.location = target - direction * distance
camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.type = "ORTHO"
camera.data.ortho_scale = 8.0

light = bpy.data.objects.get("KEY_LIGHT_TOP_LEFT")
if light:
    light.location = (-5.5, -6.5, 11)
    light.rotation_euler = (Vector((0, 0, 1.8)) - light.location).to_track_quat("-Z", "Y").to_euler()
    light.data.energy = 1050

for obj in scene.objects:
    if obj.type == "MESH" and obj.parent != root:
        obj.hide_render = True

scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.resolution_percentage = 100
results = []
for resolution, name in ((512, "storehouse_render_512.png"), (1024, "storehouse_paint_base_1024.png")):
    scene.render.resolution_x = resolution
    scene.render.resolution_y = resolution
    path = os.path.join(out, name)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    results.append(path)

buildings_dir = os.path.join(project, "assets", "source", "blender", "buildings")
os.makedirs(buildings_dir, exist_ok=True)
blend_path = os.path.join(buildings_dir, "storehouse.blend")
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
print(json.dumps({"blend": blend_path, "renders": results, "camera": [10.0, 59.5051]}, ensure_ascii=True))
