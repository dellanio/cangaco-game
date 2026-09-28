import bpy
import json
import math
import os

from mathutils import Vector


scene = bpy.context.scene
project = globals().get("PIANCO_PROJECT_ROOT", os.path.abspath(os.getcwd()))
out = os.path.join(project, "tmp", "blender", "material-azimuth-test")
os.makedirs(out, exist_ok=True)


def mat(name, color, roughness=0.9, metallic=0.0):
    value = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    value.use_nodes = True
    shader = next(n for n in value.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    return value


stone = mat("TEST_PEDRA_BRUTA", (0.32, 0.28, 0.22, 1), 0.98)
stone_light = mat("TEST_PEDRA_PISO", (0.48, 0.42, 0.33, 1), 0.96)
wood = mat("TEST_MADEIRA", (0.20, 0.075, 0.025, 1), 0.94)
wood_light = mat("TEST_MADEIRA_CLARA", (0.38, 0.17, 0.055, 1), 0.92)
coal = mat("TEST_ESCURO", (0.025, 0.022, 0.018, 1), 0.82)
zinc = mat("TEST_ZINCO", (0.20, 0.22, 0.20, 1), 0.72, 0.32)
thatch = mat("TEST_PALHA_ESCURA", (0.17, 0.095, 0.028, 1), 1.0)
iron = mat("TEST_FERRO", (0.07, 0.065, 0.055, 1), 0.68, 0.45)

for obj in list(bpy.data.objects):
    if obj.name.startswith(("TEST_QUARRY_", "TEST_WOODCUTTER_")):
        bpy.data.objects.remove(obj, do_unlink=True)


def block(root, name, dimensions, location, material, bevel=0.025, rotation=None):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.dimensions = dimensions
    if rotation:
        obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    obj.parent = root
    if bevel:
        mod = obj.modifiers.new("EDGE_SOFTENING", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    if hasattr(obj, "visible_shadow"):
        obj.visible_shadow = False
    return obj


def cylinder(root, name, radius, depth, location, material, rotation=(0, 0, 0), vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(material)
    obj.parent = root
    bevel = obj.modifiers.new("EDGE_SOFTENING", "BEVEL")
    bevel.width = 0.018
    bevel.segments = 2
    if hasattr(obj, "visible_shadow"):
        obj.visible_shadow = False
    return obj


quarry = bpy.data.objects.new("TEST_QUARRY_ROOT", None)
scene.collection.objects.link(quarry)
quarry.rotation_euler.z = math.radians(-10)
quarry["footprint_tiles"] = [3, 2]
quarry["view"] = "esquerda"

# Stone yard, retaining wall and front ramp.
block(quarry, "TEST_QUARRY_FLOOR", (2.80, 1.72, 0.18), (0, 0, 0.09), stone_light, 0.035)
for x in (-1.33, 1.33):
    block(quarry, f"TEST_QUARRY_SIDE_WALL_{x}", (0.20, 1.72, 0.52), (x, 0, 0.34), stone, 0.035)
block(quarry, "TEST_QUARRY_BACK_WALL", (2.72, 0.20, 0.58), (0, 0.76, 0.38), stone, 0.035)
for step in range(4):
    block(quarry, f"TEST_QUARRY_RAMP_{step}", (0.92, 0.34, 0.10 + step * 0.08),
          (0.74, -1.02 + step * 0.23, (0.10 + step * 0.08) / 2), stone_light, 0.018)

# Zinc-roofed cutting shelter on the left rear.
for x in (-1.08, 0.10):
    block(quarry, f"TEST_QUARRY_SHED_POST_{x}", (0.13, 0.13, 1.62), (x, 0.48, 1.10), wood, 0.018)
block(quarry, "TEST_QUARRY_SHED_BEAM", (1.38, 0.14, 0.15), (-0.48, 0.48, 1.88), wood, 0.018)
block(quarry, "TEST_QUARRY_ZINC_ROOF", (1.62, 1.12, 0.10), (-0.48, 0.28, 2.03), zinc, 0.018,
      (math.radians(-7), 0, 0))

# Dominant winch silhouette, drum and hanging hook.
for x in (-0.62, 0.62):
    block(quarry, f"TEST_QUARRY_WINCH_POST_{x}", (0.16, 0.16, 2.25), (x, -0.08, 1.32), wood, 0.025)
block(quarry, "TEST_QUARRY_WINCH_TOP", (1.58, 0.20, 0.19), (0, -0.08, 2.43), wood, 0.025)
cylinder(quarry, "TEST_QUARRY_DRUM", 0.22, 0.72, (0.22, -0.12, 2.12), wood_light,
         (0, math.radians(90), 0), 20)
cylinder(quarry, "TEST_QUARRY_ROPE", 0.025, 1.18, (0.22, -0.12, 1.43), coal, (0, 0, 0), 10)
cylinder(quarry, "TEST_QUARRY_HOOK", 0.075, 0.18, (0.22, -0.12, 0.80), iron, (0, 0, 0), 12)


woodcutter = bpy.data.objects.new("TEST_WOODCUTTER_ROOT", None)
scene.collection.objects.link(woodcutter)
woodcutter.rotation_euler.z = math.radians(-10)
woodcutter["footprint_tiles"] = [3, 2]
woodcutter["view"] = "direita"

block(woodcutter, "TEST_WOODCUTTER_FOUNDATION", (2.55, 1.62, 0.20), (0, 0, 0.10), stone, 0.035)

# Horizontal stacked-log walls, visibly a cabin rather than plastered masonry.
for row in range(8):
    z = 0.31 + row * 0.18
    cylinder(woodcutter, f"TEST_WOODCUTTER_FRONT_LOG_{row}", 0.105, 2.46, (0, -0.72, z), wood_light,
             (0, math.radians(90), 0), 14)
    cylinder(woodcutter, f"TEST_WOODCUTTER_BACK_LOG_{row}", 0.105, 2.46, (0, 0.72, z), wood_light,
             (0, math.radians(90), 0), 14)
    cylinder(woodcutter, f"TEST_WOODCUTTER_LEFT_LOG_{row}", 0.105, 1.44, (-1.18, 0, z), wood,
             (math.radians(90), 0, 0), 14)
    cylinder(woodcutter, f"TEST_WOODCUTTER_RIGHT_LOG_{row}", 0.105, 1.44, (1.18, 0, z), wood,
             (math.radians(90), 0, 0), 14)

# Door/window plates interrupt the log rhythm visually without changing the silhouette.
block(woodcutter, "TEST_WOODCUTTER_DOOR", (0.62, 0.10, 1.12), (0.38, -0.81, 0.77), wood, 0.018)
block(woodcutter, "TEST_WOODCUTTER_WINDOW", (0.48, 0.08, 0.48), (-0.62, -0.82, 1.00), coal, 0.012)
block(woodcutter, "TEST_WOODCUTTER_WINDOW_FRAME", (0.60, 0.07, 0.08), (-0.62, -0.86, 1.25), wood, 0.010)

# Dark brown thatch roof, broad eaves, two slopes.
roof_angle = math.radians(28)
block(woodcutter, "TEST_WOODCUTTER_THATCH_FRONT", (2.90, 1.22, 0.16), (0, -0.43, 1.86), thatch, 0.035,
      (roof_angle, 0, 0))
block(woodcutter, "TEST_WOODCUTTER_THATCH_BACK", (2.90, 1.22, 0.16), (0, 0.43, 1.86), thatch, 0.035,
      (-roof_angle, 0, 0))
block(woodcutter, "TEST_WOODCUTTER_RIDGE", (2.92, 0.16, 0.16), (0, 0, 2.13), thatch, 0.04)

# Functional objects: stump with axe and log trestle.
cylinder(woodcutter, "TEST_WOODCUTTER_STUMP", 0.28, 0.42, (-0.90, -1.00, 0.25), wood_light, (0, 0, 0), 16)
block(woodcutter, "TEST_WOODCUTTER_AXE_HEAD", (0.30, 0.07, 0.16), (-0.90, -1.02, 0.64), iron, 0.015,
      (0, math.radians(-20), math.radians(8)))
block(woodcutter, "TEST_WOODCUTTER_AXE_HANDLE", (0.07, 0.07, 0.72), (-0.78, -1.02, 0.67), wood, 0.012,
      (0, math.radians(-20), math.radians(8)))
for x in (0.72, 1.13):
    block(woodcutter, f"TEST_WOODCUTTER_TRESTLE_{x}", (0.09, 0.62, 0.56), (x, -0.93, 0.34), wood, 0.015)
cylinder(woodcutter, "TEST_WOODCUTTER_TRESTLE_LOG", 0.16, 1.12, (0.92, -0.94, 0.64), wood_light,
         (0, math.radians(90), 0), 14)


camera = bpy.data.objects["CAMERA_REFERENCE_PIANGO"]
target = Vector((0, 0, 1.15))
distance = 20.0


def set_camera(azimuth_degrees, elevation_degrees):
    azimuth = math.radians(azimuth_degrees)
    elevation = math.radians(elevation_degrees)
    direction = Vector((
        math.sin(azimuth) * math.cos(elevation),
        math.cos(azimuth) * math.cos(elevation),
        -math.sin(elevation),
    ))
    camera.location = target - direction * distance
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 8.0
    bpy.context.view_layer.update()


light = bpy.data.objects.get("KEY_LIGHT_TOP_LEFT")
if light:
    light.location = (-5.5, -6.5, 11)
    light.rotation_euler = (Vector((0, 0, 1.2)) - light.location).to_track_quat("-Z", "Y").to_euler()
    light.data.energy = 1050

scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.resolution_percentage = 100

views = (
    ("quarry", quarry, woodcutter, 20.0, 63.2080),
    ("woodcutters", woodcutter, quarry, 0.0, 56.7754),
)
results = []
# The reference blend contains the canonical test house and the Coronel model.
# Only the two roots authored by this script may participate in these renders.
for obj in scene.objects:
    if obj.type == "MESH" and obj.parent not in {quarry, woodcutter}:
        obj.hide_render = True

for asset_id, visible, hidden, azimuth, elevation in views:
    visible.hide_render = False
    hidden.hide_render = True
    for obj in scene.objects:
        if obj.parent == visible:
            obj.hide_render = False
        elif obj.parent == hidden:
            obj.hide_render = True
    set_camera(azimuth, elevation)
    for resolution, suffix in ((512, "render_512"), (1024, "paint_base_1024")):
        scene.render.resolution_x = resolution
        scene.render.resolution_y = resolution
        path = os.path.join(out, f"{asset_id}_{suffix}.png")
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        results.append({"id": asset_id, "azimuth": azimuth, "elevation": elevation, "render": path})

blend_path = os.path.join(out, "quarry_woodcutter_candidate.blend")
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
print(json.dumps({"blend": blend_path, "renders": results}, ensure_ascii=True))
