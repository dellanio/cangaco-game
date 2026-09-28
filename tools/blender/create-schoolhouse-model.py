import bpy
import json
import math
import os

from mathutils import Vector


scene = bpy.context.scene
root_dir = globals().get("PIANCO_PROJECT_ROOT", os.path.abspath(os.getcwd()))
output_dir = os.path.join(root_dir, "tmp", "blender", "schoolhouse")
os.makedirs(output_dir, exist_ok=True)


def material(name, color, roughness=0.85):
    result = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    result.use_nodes = True
    principled = next(node for node in result.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Roughness"].default_value = roughness
    return result


wall = material("CORONEL_CAL", (0.78, 0.65, 0.45, 1.0), 0.95)
roof = material("CORONEL_TELHA", (0.62, 0.16, 0.045, 1.0), 0.88)
wood = material("CORONEL_MADEIRA", (0.22, 0.075, 0.025, 1.0), 0.92)
stone = material("CORONEL_PEDRA", (0.34, 0.29, 0.22, 1.0), 0.96)
shutter = material("CORONEL_VENEZIANA", (0.025, 0.20, 0.17, 1.0), 0.76)
dark = material("CORONEL_ABERTURA", (0.012, 0.018, 0.016, 1.0), 0.70)

for obj in list(bpy.data.objects):
    if obj.name.startswith("CORONEL_"):
        bpy.data.objects.remove(obj, do_unlink=True)

root = bpy.data.objects.new("CORONEL_SCHOOLHOUSE_3x3", None)
scene.collection.objects.link(root)
# Reduce the complete authored volume around the ground origin. This keeps the
# canonical camera and proportions intact while limiting roof/stair overflow.
model_scale = 0.90
root.scale = (model_scale, model_scale, model_scale)
# The canonical camera keeps its 10-degree azimuth. Counter-rotate this facade
# so the authored front reads almost straight-on like the approved woodcutter.
root.rotation_euler.z = math.radians(-10.0)
root["facade_compensation_degrees"] = -10.0
root["footprint_tiles"] = [3, 3]
root["height_factor_f_esc"] = 1.4
root["model_scale"] = model_scale
root["height_factor_basis"] = "3.5 human heights / 2.5 human heights"
root["architecture_reference"] = "assets/base/schoolhouse/schoolhouse_06_completo.png"


def block(name, dimensions, location, mat, bevel=0.025, rotation=None):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.dimensions = dimensions
    if rotation is not None:
        obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    obj.parent = root
    if bevel > 0:
        modifier = obj.modifiers.new(name="EDGE_SOFTENING", type="BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    if hasattr(obj, "visible_shadow"):
        obj.visible_shadow = False
    return obj


block("CORONEL_STONE_BASE", (2.86, 2.72, 0.42), (0.0, 0.0, 0.21), stone, 0.045)
block("CORONEL_WALL_BODY", (2.58, 2.42, 3.25), (0.0, 0.0, 2.025), wall, 0.04)
block("CORONEL_FLOOR_BAND", (2.70, 2.52, 0.16), (0.0, 0.0, 2.02), wood, 0.018)
for x in (-1.22, 1.22):
    block(f"CORONEL_CORNER_POST_{x:+.2f}", (0.12, 0.13, 3.28), (x, -1.20, 2.04), wood, 0.015)

# Double front door.
for index, x in enumerate((-0.31, 0.31)):
    block(f"CORONEL_DOUBLE_DOOR_{index}", (0.58, 0.10, 1.24), (x, -1.265, 1.05), shutter, 0.016)
    block(f"CORONEL_DOOR_BAR_{index}", (0.48, 0.035, 0.07), (x, -1.325, 1.05), wood, 0.008)
block("CORONEL_DOOR_LINTEL", (1.30, 0.14, 0.15), (0.0, -1.27, 1.72), stone, 0.02)


def front_window(name, x, z, width=0.52, height=0.62):
    block(f"{name}_DARK", (width, 0.075, height), (x, -1.255, z), dark, 0.012)
    for suffix, sx in (("L", x - width * 0.32), ("R", x + width * 0.32)):
        block(f"{name}_SHUTTER_{suffix}", (width * 0.28, 0.075, height * 1.06), (sx, -1.31, z), shutter, 0.012)
        block(f"{name}_HINGE_{suffix}", (width * 0.20, 0.025, 0.045), (sx, -1.355, z), wood, 0.004)
    block(f"{name}_SILL", (width * 1.15, 0.12, 0.08), (x, -1.29, z - height * 0.56), stone, 0.012)


front_window("CORONEL_WINDOW_GROUND_LEFT", -0.90, 1.22, 0.42, 0.56)
for x in (-0.82, 0.0, 0.82):
    front_window(f"CORONEL_WINDOW_UPPER_{x:+.2f}", x, 2.82, 0.45, 0.58)


def side_window(name, y, z):
    block(f"{name}_DARK", (0.075, 0.52, 0.58), (1.315, y, z), dark, 0.012)
    for suffix, sy in (("F", y - 0.18), ("B", y + 0.18)):
        block(f"{name}_SHUTTER_{suffix}", (0.075, 0.15, 0.62), (1.365, sy, z), shutter, 0.012)
        block(f"{name}_HINGE_{suffix}", (0.025, 0.11, 0.045), (1.405, sy, z), wood, 0.004)


side_window("CORONEL_SIDE_GROUND", 0.30, 1.23)
side_window("CORONEL_SIDE_UPPER_FRONT", -0.47, 2.80)
side_window("CORONEL_SIDE_UPPER_BACK", 0.48, 2.80)

# Covered veranda, posts and restrained railing.
block("CORONEL_VERANDA_DECK", (2.90, 1.05, 0.14), (0.0, -1.48, 0.53), wood, 0.022)
# Keep the supports at the front edge so they read as an open alpendre instead
# of merging into the facade.  The inner pair frames the double door.
for x in (-1.22, -0.72, 0.72, 1.22):
    block(f"CORONEL_VERANDA_POST_{x:+.2f}", (0.14, 0.14, 1.68), (x, -1.78, 1.37), wood, 0.018)
block("CORONEL_VERANDA_BEAM", (2.72, 0.14, 0.16), (0.0, -1.78, 2.16), wood, 0.018)
block(
    "CORONEL_VERANDA_ROOF",
    (3.10, 0.66, 0.11),
    (0.0, -1.55, 2.31),
    roof,
    0.025,
    (math.radians(-7.0), 0.0, 0.0),
)
block("CORONEL_VERANDA_SHADOW", (2.92, 0.52, 0.045), (0.0, -1.55, 2.22), dark, 0.008)
for x in (-1.15, -0.86, 0.86, 1.15):
    block(f"CORONEL_RAIL_{x:+.2f}", (0.065, 0.08, 0.62), (x, -1.72, 0.91), wood, 0.009)
block("CORONEL_RAIL_TOP", (0.72, 0.10, 0.10), (-1.00, -1.72, 1.20), wood, 0.01)
block("CORONEL_RAIL_TOP_R", (0.72, 0.10, 0.10), (1.00, -1.72, 1.20), wood, 0.01)

# Stone stair centered on the double door.
for index in range(4):
    depth = 0.28 + index * 0.16
    height = 0.11 * (index + 1)
    y = -2.28 + index * 0.16
    block(f"CORONEL_STAIR_{index}", (1.24, depth, height), (0.0, y, height / 2.0), stone, 0.018)
block("CORONEL_STAIR_LANDING", (1.24, 0.52, 0.50), (0.0, -1.34, 0.25), stone, 0.02)

# Four-slope hip roof: two trapezoids and two triangular hips.
vertices = [
    (-1.85, -1.25, 3.72), (1.85, -1.25, 3.72),
    (-1.85, 1.25, 3.72), (1.85, 1.25, 3.72),
    (-1.05, 0.0, 4.05), (1.05, 0.0, 4.05),
]
faces = [
    (0, 1, 5, 4),
    (3, 2, 4, 5),
    (2, 0, 4),
    (1, 3, 5),
]
mesh = bpy.data.meshes.new("CORONEL_HIP_ROOF_MESH")
mesh.from_pydata(vertices, [], faces)
mesh.update()
hip = bpy.data.objects.new("CORONEL_HIP_ROOF", mesh)
scene.collection.objects.link(hip)
hip.data.materials.append(roof)
hip.parent = root
solidify = hip.modifiers.new(name="ROOF_THICKNESS", type="SOLIDIFY")
solidify.thickness = 0.10
bevel = hip.modifiers.new(name="ROOF_EDGE_SOFTENING", type="BEVEL")
bevel.width = 0.025
bevel.segments = 2
if hasattr(hip, "visible_shadow"):
    hip.visible_shadow = False
block("CORONEL_RIDGE_CAP", (2.16, 0.11, 0.11), (0.0, 0.0, 4.07), roof, 0.03)

# Fix canonical camera at the selected 10-degree test, with elevation compensated
# to preserve the measured roof/wall ratio 1.479.
camera = bpy.data.objects["CAMERA_REFERENCE_PIANGO"]
target = Vector((0.0, 0.0, 1.5))
distance = 20.0
azimuth_degrees = 10.0
elevation_degrees = 59.5051
azimuth = math.radians(azimuth_degrees)
elevation = math.radians(elevation_degrees)
view_direction = Vector((
    math.sin(azimuth) * math.cos(elevation),
    math.cos(azimuth) * math.cos(elevation),
    -math.sin(elevation),
))
camera.location = target - view_direction * distance
camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
camera["lateral_azimuth_degrees"] = azimuth_degrees
camera["elevation_degrees"] = elevation_degrees
camera["calibration"] = "azimuth 10 selected by operator; elevation compensated for roof/wall 1.479"

light = bpy.data.objects.get("KEY_LIGHT_TOP_LEFT")
if light is not None:
    light.location = (-5.5, -6.5, 11.0)
    light.rotation_euler = (Vector((0.0, 0.0, 2.0)) - light.location).to_track_quat("-Z", "Y").to_euler()
    light.data.energy = 1050.0
    light["rule"] = "single front-upper-left key; no fill; cast shadow excluded from sprite"

for obj in scene.objects:
    if obj == root or obj.parent == root or obj.type in {"CAMERA", "LIGHT"}:
        continue
    if obj.type == "MESH" or obj.type == "EMPTY":
        obj.hide_render = True

scene.render.resolution_x = 512
scene.render.resolution_y = 512
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.filepath = os.path.join(output_dir, "schoolhouse_render_512.png")
bpy.ops.render.render(write_still=True)

# High-resolution paint base. It preserves the exact camera and alpha but gives
# the repaint stage twice the linear detail of the in-game 64 px/tile raster.
scene.render.resolution_x = 1024
scene.render.resolution_y = 1024
scene.render.filepath = os.path.join(output_dir, "schoolhouse_paint_base_1024.png")
bpy.ops.render.render(write_still=True)
scene.render.resolution_x = 512
scene.render.resolution_y = 512

# Construction pass: the same footprint, camera and source coordinates. The
# tiled hip roof is already mounted, while posts, floor beams, braces and roof
# trestles remain exposed and the masonry walls do not exist yet.
wood_root = bpy.data.objects.new("CORONEL_WOOD_STAGE_3x3", None)
scene.collection.objects.link(wood_root)
wood_root.rotation_euler.z = math.radians(-10.0)
wood_root.scale = (model_scale, model_scale, model_scale)
wood_root["stage"] = "madeira"
wood_root["registration"] = "same 512x512 camera as complete render"


def wood_block(name, dimensions, location, mat=wood, bevel_size=0.018, rotation=None):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.dimensions = dimensions
    if rotation is not None:
        obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    obj.parent = wood_root
    if bevel_size > 0:
        modifier = obj.modifiers.new(name="EDGE_SOFTENING", type="BEVEL")
        modifier.width = bevel_size
        modifier.segments = 2
    if hasattr(obj, "visible_shadow"):
        obj.visible_shadow = False
    return obj


for source_name in ["CORONEL_STONE_BASE", "CORONEL_STAIR_0", "CORONEL_STAIR_1", "CORONEL_STAIR_2", "CORONEL_STAIR_3", "CORONEL_STAIR_LANDING"]:
    source = bpy.data.objects[source_name]
    duplicate = source.copy()
    duplicate.data = source.data.copy()
    duplicate.name = source_name.replace("CORONEL_", "CORONEL_WOOD_")
    scene.collection.objects.link(duplicate)
    duplicate.parent = wood_root

for x in (-1.20, 0.0, 1.20):
    for y in (-1.10, 1.10):
        wood_block(f"CORONEL_WOOD_POST_{x:+.1f}_{y:+.1f}", (0.14, 0.14, 3.25), (x, y, 2.04))
for z in (0.52, 2.02, 3.62):
    wood_block(f"CORONEL_WOOD_FRONT_BEAM_{z:.2f}", (2.62, 0.14, 0.16), (0.0, -1.10, z))
    wood_block(f"CORONEL_WOOD_BACK_BEAM_{z:.2f}", (2.62, 0.14, 0.16), (0.0, 1.10, z))
    wood_block(f"CORONEL_WOOD_LEFT_BEAM_{z:.2f}", (0.14, 2.34, 0.16), (-1.20, 0.0, z))
    wood_block(f"CORONEL_WOOD_RIGHT_BEAM_{z:.2f}", (0.14, 2.34, 0.16), (1.20, 0.0, z))
for x, angle in ((-0.62, -math.radians(48)), (0.62, math.radians(48))):
    wood_block(f"CORONEL_WOOD_BRACE_LOW_{x:+.2f}", (1.25, 0.10, 0.11), (x, -1.18, 1.25), rotation=(0.0, angle, 0.0))
    wood_block(f"CORONEL_WOOD_BRACE_HIGH_{x:+.2f}", (1.25, 0.10, 0.11), (x, -1.18, 2.82), rotation=(0.0, angle, 0.0))

# Roof trestles remain visible under the already mounted tile roof.
for x in (-0.82, 0.0, 0.82):
    wood_block(f"CORONEL_WOOD_TRESTLE_L_{x:+.2f}", (1.78, 0.10, 0.11), (x, -0.72, 3.91), rotation=(math.radians(-15.8), 0.0, 0.0))
    wood_block(f"CORONEL_WOOD_TRESTLE_R_{x:+.2f}", (1.78, 0.10, 0.11), (x, 0.72, 3.91), rotation=(math.radians(15.8), 0.0, 0.0))

wood_hip = hip.copy()
wood_hip.data = hip.data.copy()
wood_hip.name = "CORONEL_WOOD_HIP_ROOF"
scene.collection.objects.link(wood_hip)
wood_hip.parent = wood_root
wood_ridge = bpy.data.objects["CORONEL_RIDGE_CAP"].copy()
wood_ridge.data = bpy.data.objects["CORONEL_RIDGE_CAP"].data.copy()
wood_ridge.name = "CORONEL_WOOD_RIDGE_CAP"
scene.collection.objects.link(wood_ridge)
wood_ridge.parent = wood_root

for obj in scene.objects:
    if obj == root or obj.parent == root:
        obj.hide_render = True
    elif obj == wood_root or obj.parent == wood_root:
        obj.hide_render = False
scene.render.filepath = os.path.join(output_dir, "schoolhouse_madeira_render_512.png")
bpy.ops.render.render(write_still=True)

for obj in scene.objects:
    if obj == root or obj.parent == root:
        obj.hide_render = False
    elif obj == wood_root or obj.parent == wood_root:
        obj.hide_render = True
scene.render.filepath = os.path.join(output_dir, "schoolhouse_render_512.png")

reference_path = os.path.join(root_dir, "assets", "source", "blender", "reference_scene.blend")
buildings_dir = os.path.join(root_dir, "assets", "source", "blender", "buildings")
os.makedirs(buildings_dir, exist_ok=True)
schoolhouse_path = os.path.join(buildings_dir, "schoolhouse.blend")
bpy.ops.wm.save_as_mainfile(filepath=schoolhouse_path)

print(json.dumps({
    "render": scene.render.filepath,
    "wood_render": os.path.join(output_dir, "schoolhouse_madeira_render_512.png"),
    "reference_scene": reference_path,
    "source_scene": schoolhouse_path,
    "camera": {"azimuth": azimuth_degrees, "elevation": elevation_degrees},
    "footprint": [3, 3],
    "height_factor": 1.4,
    "model_scale": model_scale,
    "object_count": len([obj for obj in scene.objects if obj == root or obj.parent == root]),
}, ensure_ascii=True))
