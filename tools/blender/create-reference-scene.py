import bpy
import json
import math
import os
from mathutils import Vector


scene = bpy.context.scene

# One Blender world unit is one square 64x64 game tile.
scene.unit_settings.system = "METRIC"
scene.unit_settings.scale_length = 1.0
scene.unit_settings.length_unit = "METERS"
scene["pianco_tile_world_units"] = 1.0
scene["pianco_tile_pixels"] = 64
scene["pianco_projection_status"] = (
    "canonical-camera plus 3x2 house appearance test; building overflow awaits measured table"
)
scene["pianco_camera_rule"] = (
    "orthographic, 10 degree lateral azimuth, world Z vertical"
)
scene["pianco_camera_calibration"] = (
    "KaM screenshots: roof/wall 240/162=1.481 and 257/174=1.477; "
    "mean=1.479; operator selected azimuth 10deg; compensated elevation 59.5051deg"
)

for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)

for material in list(bpy.data.materials):
    if material.users == 0:
        bpy.data.materials.remove(material)

# Minimal neutral world contribution keeps the facade readable without adding
# a second directional source or changing the key-light convention.
if scene.world is None:
    scene.world = bpy.data.worlds.new("PIANCO_WORLD")
scene.world.use_nodes = True
background = next(
    (node for node in scene.world.node_tree.nodes if node.type == "BACKGROUND"),
    None,
)
if background:
    background.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    background.inputs["Strength"].default_value = 0.06

def create_material(name, color, roughness=0.82):
    result = bpy.data.materials.new(name)
    result.diffuse_color = color
    result.use_nodes = True
    principled = next(
        (node for node in result.node_tree.nodes if node.type == "BSDF_PRINCIPLED"),
        None,
    )
    if principled:
        principled.inputs["Base Color"].default_value = color
        principled.inputs["Roughness"].default_value = roughness
    return result


material = create_material(
    "PROJECTION_TEST_TERRACOTTA", (0.55, 0.16, 0.045, 1.0)
)
wall_material = create_material(
    "HOUSE_WALL_WHITEWASH", (0.80, 0.62, 0.38, 1.0), 0.92
)
roof_material = create_material(
    "HOUSE_ROOF_TERRACOTTA", (0.62, 0.15, 0.035, 1.0), 0.88
)
wood_material = create_material(
    "HOUSE_WOOD", (0.20, 0.075, 0.025, 1.0), 0.90
)
window_material = create_material(
    "HOUSE_WINDOW_DARK_BLUE", (0.035, 0.14, 0.17, 1.0), 0.55
)


def create_projection_block(name, dimensions, location, footprint):
    bpy.ops.mesh.primitive_cube_add(location=location)
    block = bpy.context.active_object
    block.name = name
    block.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    block["footprint_tiles"] = footprint
    block["height_world_units"] = dimensions[2]
    block["purpose"] = "camera projection and proportional-scale gate"
    block.data.materials.append(material)

    bevel = block.modifiers.new(name="EDGE_SOFTENING_0_03", type="BEVEL")
    bevel.width = 0.03
    bevel.segments = 2

    # Main building sprites never contain a cast ground shadow.
    if hasattr(block, "visible_shadow"):
        block.visible_shadow = False
    return block


block_3x2 = create_projection_block(
    "PROJECTION_TEST_3x2x2",
    (3.0, 2.0, 2.0),
    (-2.0, 0.0, 1.0),
    [3, 2],
)
block_3x3 = create_projection_block(
    "PROPORTION_TEST_3x3x3",
    (3.0, 3.0, 3.0),
    (2.0, 0.0, 1.5),
    [3, 3],
)


def create_house_cube(name, dimensions, location, material_ref, parent, bevel=0.025):
    bpy.ops.mesh.primitive_cube_add(location=location)
    part = bpy.context.active_object
    part.name = name
    part.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    part.data.materials.append(material_ref)
    part.parent = parent
    if bevel > 0:
        modifier = part.modifiers.new(name="EDGE_SOFTENING", type="BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    if hasattr(part, "visible_shadow"):
        part.visible_shadow = False
    return part


house = bpy.data.objects.new("REFERENCE_HOUSE_3x2", None)
scene.collection.objects.link(house)
house["footprint_tiles"] = [3, 2]
house["purpose"] = "first canonical camera appearance gate"
house["style"] = "single-storey whitewashed timber house with gable roof"

create_house_cube(
    "HOUSE_WALLS",
    (2.72, 1.72, 2.14),
    (0.0, 0.0, 1.07),
    wall_material,
    house,
    0.035,
)

# Front facade faces camera at negative Y. Door and window stay within the wall
# plane; neither changes the 3x2 footprint.
create_house_cube(
    "HOUSE_DOOR",
    (0.58, 0.09, 1.42),
    (0.58, -0.895, 0.71),
    wood_material,
    house,
    0.018,
)
create_house_cube(
    "HOUSE_WINDOW_GLASS",
    (0.62, 0.075, 0.52),
    (-0.58, -0.903, 1.23),
    window_material,
    house,
    0.012,
)

for name, dimensions, location in (
    ("HOUSE_WINDOW_FRAME_TOP", (0.72, 0.085, 0.07), (-0.58, -0.948, 1.525)),
    ("HOUSE_WINDOW_FRAME_BOTTOM", (0.72, 0.085, 0.07), (-0.58, -0.948, 0.935)),
    ("HOUSE_WINDOW_FRAME_LEFT", (0.07, 0.085, 0.66), (-0.94, -0.948, 1.23)),
    ("HOUSE_WINDOW_FRAME_RIGHT", (0.07, 0.085, 0.66), (-0.22, -0.948, 1.23)),
    ("HOUSE_WINDOW_MULLION_X", (0.62, 0.09, 0.045), (-0.58, -0.953, 1.23)),
    ("HOUSE_WINDOW_MULLION_Z", (0.045, 0.09, 0.52), (-0.58, -0.953, 1.23)),
):
    create_house_cube(name, dimensions, location, wood_material, house, 0.008)

for x_pos in (-1.29, 1.29):
    create_house_cube(
        f"HOUSE_CORNER_POST_{'LEFT' if x_pos < 0 else 'RIGHT'}",
        (0.11, 0.10, 2.16),
        (x_pos, -0.91, 1.08),
        wood_material,
        house,
        0.012,
    )

# Two roof planes, ridge along world X. Their outer extents remain exactly
# 3x2 world units, matching the declared footprint.
roof_half_depth = 1.0
roof_rise = 0.68
roof_eave_z = 2.15
roof_slope_length = math.hypot(roof_half_depth, roof_rise)
roof_angle = math.atan2(roof_rise, roof_half_depth)
for name, y_pos, angle in (
    ("HOUSE_ROOF_FRONT", -roof_half_depth / 2, roof_angle),
    ("HOUSE_ROOF_BACK", roof_half_depth / 2, -roof_angle),
):
    panel = create_house_cube(
        name,
        (3.0, roof_slope_length, 0.13),
        (0.0, y_pos, roof_eave_z + roof_rise / 2),
        roof_material,
        house,
        0.028,
    )
    panel.rotation_euler.x = angle

create_house_cube(
    "HOUSE_RIDGE_CAP",
    (3.04, 0.12, 0.12),
    (0.0, 0.0, roof_eave_z + roof_rise + 0.015),
    roof_material,
    house,
    0.025,
)

# Zero lateral azimuth keeps X horizontal and Z vertical on screen.
camera_data = bpy.data.cameras.new("CAMERA_REFERENCE_PIANGO_DATA")
camera = bpy.data.objects.new("CAMERA_REFERENCE_PIANGO", camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
camera_data.type = "ORTHO"
camera_data.ortho_scale = 8.0
camera_data.clip_start = 0.1
camera_data.clip_end = 200.0

elevation_deg = 59.5051
azimuth_deg = 10.0
distance = 20.0
target = Vector((0.0, 0.0, 1.5))
elevation = math.radians(elevation_deg)
azimuth = math.radians(azimuth_deg)
view_direction = Vector((
    math.sin(azimuth) * math.cos(elevation),
    math.cos(azimuth) * math.cos(elevation),
    -math.sin(elevation),
))
camera.location = target - view_direction * distance
camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
camera["projection"] = "ORTHOGRAPHIC"
camera["elevation_degrees"] = elevation_deg
camera["blender_rotation_x_degrees"] = round(math.degrees(camera.rotation_euler.x), 6)
camera["lateral_azimuth_degrees"] = azimuth_deg
camera["ortho_scale"] = 8.0
camera["pixels_per_world_unit_at_512"] = 64.0

# Exactly one key light, upper-left in camera space.
light_data = bpy.data.lights.new(name="KEY_LIGHT_TOP_LEFT_DATA", type="AREA")
light_data.energy = 1050.0
light_data.shape = "DISK"
light_data.size = 4.0
light = bpy.data.objects.new(name="KEY_LIGHT_TOP_LEFT", object_data=light_data)
scene.collection.objects.link(light)
light.location = (-5.5, -6.5, 11.0)
light.rotation_euler = (target - light.location).to_track_quat("-Z", "Y").to_euler()
light["rule"] = (
    "single upper-left key; hypothetical cast shadow down-right; "
    "minimal neutral world 0.06; no second directional light; "
    "cast shadow excluded from main sprite render"
)

# Non-rendering tile-size reference.
bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0.0, 0.0, 0.002))
tile_reference = bpy.context.active_object
tile_reference.name = "REFERENCE_TILE_1x1_64px"
tile_reference.display_type = "WIRE"
tile_reference.hide_render = True
tile_reference["world_units"] = [1.0, 1.0]
tile_reference["game_pixels"] = [64, 64]

scene.render.engine = "CYCLES"
scene.cycles.samples = 64
scene.cycles.use_denoising = True
scene.render.resolution_x = 512
scene.render.resolution_y = 512
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.color_depth = "8"
scene.render.image_settings.compression = 15
scene.render.film_transparent = True
scene.render.pixel_aspect_x = 1.0
scene.render.pixel_aspect_y = 1.0

root = globals().get("PIANCO_PROJECT_ROOT", os.path.abspath(os.getcwd()))
output_dir = os.path.join(root, "assets", "source", "blender")
scratch_dir = os.path.join(root, "tmp", "blender", "reference")
os.makedirs(output_dir, exist_ok=True)
os.makedirs(scratch_dir, exist_ok=True)
blend_path = os.path.join(output_dir, "reference_scene.blend")
projection_render_path = os.path.join(scratch_dir, "reference_projection_test.png")
house_render_path = os.path.join(scratch_dir, "reference_house_test.png")

notes = bpy.data.texts.get("PIANCO_REFERENCE_CAMERA") or bpy.data.texts.new(
    "PIANCO_REFERENCE_CAMERA"
)
notes.clear()
notes.write(
    "PIANCO CAMERA REFERENCE\n"
    "1 Blender world unit = 1 orthogonal game tile = 64x64 px.\n"
    "512x512 render with ortho_scale 8 = 64 px/world unit.\n"
    "Orthographic camera, elevation 56 degrees, lateral azimuth 0 degrees.\n"
    "Blender Transform displays Rotation X = 34 degrees (90 - elevation).\n"
    "Calibration: KaM roof/wall ratios 1.481 and 1.477; mean 1.479; "
    "atan(mean) = 55.94 degrees for equal-depth-height test blocks.\n"
    "The main sprite pass excludes cast ground shadows.\n"
    "Blocks 3x2x2 and 3x3x3 validate projection and proportional scale only.\n"
    "REFERENCE_HOUSE_3x2 validates roof, wall, door and window appearance without camera changes.\n"
    "Building overflow and character scale await the measured table.\n"
)

# Rebuild both gates from one canonical scene. The saved/F12 state is the house
# appearance test; projection blocks remain available in the Outliner.
house.hide_render = True
block_3x2.hide_render = False
block_3x3.hide_render = False
scene.render.filepath = projection_render_path
bpy.ops.render.render(write_still=True)

house.hide_render = False
block_3x2.hide_render = True
block_3x3.hide_render = True
scene.render.filepath = house_render_path
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=blend_path)

print(
    json.dumps(
        {
            "blend": blend_path,
            "projection_render": projection_render_path,
            "house_render": house_render_path,
            "resolution": [scene.render.resolution_x, scene.render.resolution_y],
            "transparent": scene.render.film_transparent,
            "engine": scene.render.engine,
            "camera_type": camera_data.type,
            "camera_location": [round(value, 6) for value in camera.location],
            "camera_rotation_degrees": [
                round(math.degrees(value), 6) for value in camera.rotation_euler
            ],
            "camera_ortho_scale": camera_data.ortho_scale,
            "block_dimensions": {
                block_3x2.name: [round(value, 6) for value in block_3x2.dimensions],
                block_3x3.name: [round(value, 6) for value in block_3x3.dimensions],
            },
            "house_footprint": list(house["footprint_tiles"]),
            "house_parts": sorted(child.name for child in house.children),
            "lights": [obj.name for obj in scene.objects if obj.type == "LIGHT"],
        },
        ensure_ascii=True,
    )
)
