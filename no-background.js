// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: purple; icon-glyph: chess-board;

/* -----------------------------------------------

Script      : no-background.js
Author      : dev@supermamon.com
Version     : 1.8.1
Description :
  A module to create illusions of transparent
  backgrounds for Scriptable widgets

Adapted from Max Zeryck's (@mzeryck) amazing
invisible widget shared on the Automtors discourse
https://talk.automators.fm/t/widget-examples/7994/135


Changelog   :
v1.8.1
- (fix) getPathForSlice returns empty string
v1.8.0
- (new) BREAKING CHANGE: background assignments
  are unique per device so that each device can
  have it's own wallpaper. Run "Regenerate Slices"
  on each device.
  But, there's a bug the current Scriptable version
  where Device.name() returns the model instead.
  So, the wallppapers actually can't be unique
  yet. Affects stable version 1.6.12 or beta 1.7
- (new) support for iPhone 14 Pro/Pro Max.
  Thank you @mzeryck & u/Senion-Ad-883
v1.7.0
- (new) support for iPhone 12 Mini. Thanks @blacksector
v1.6.0
- (new) `transparent` and `for` alias to `getSliceForWidget`
- (new) merged `No Background Config` code to maintain 1 code
- (new) auto-detect iCloud usage
v1.5.0
- (update) iPhone 12 Pro Max compatibility
v1.4.0
- (update) also prompt for setup on the getPathForSlice method
v1.3.0
- (update) automativally prompt for setup when
  slices are missing or if the widget's
  position is not yet stored.

v1.2.0
- (new) applyTint method to simulate a
  semi-tranparent look
v1.1.1
- (fix) syntax error on generateSlices
- (fix) incorrect iPhone 12 size
v1.1.0
- Support for iPhone 12 & 12 Pro
v1.0.2
- Typos on the documentation
v1.0.1
- Fix iamge does not exists issue
----------------------------------------------- */


const ALERTS_AS_SHEETS = false

const USES_ICLOUD = usesiCloud()
const fm = FileManagerAdaptive()
const CACHE_FOLDER = 'cache/nobg'
const cachePath = fm.joinPath(fm.documentsDirectory(), CACHE_FOLDER);
const device_id = `${Device.model()}_${Device.name()}`.replace(/[^a-zA-Z0-9\-\_]/, '').toLowerCase()


const exports = {}

//------------------------------------------------
exports.cachePath = cachePath
//------------------------------------------------
exports.generateSlices = async function ({ caller = 'none' }) {
  const opts = { caller }

  let appearance = (await isUsingDarkAppearance()) ? 'dark' : 'light'
  let altAppearance = appearance == 'dark' ? 'light' : 'dark'

  if (!fm.fileExists(cachePath)) {
    fm.createDirectory(cachePath, true)
  }

  let message;

  message = "To change background make sure you have a screenshot of you home screen. Go to your home screen and enter wiggle mode. Scroll to the empty page on the far right and take a screenshot."
  let options = ["Pick Screenshot", "Exit to Take Screenshot"]
  let resp = await presentAlert(message, options, ALERTS_AS_SHEETS)
  if (resp == 1) return false

  // Get screenshot and determine phone size.
  let wallpaper = await Photos.fromLibrary()
  let height = wallpaper.size.height
  let suffix = "";

  // Check for iPhone 12 Mini here:
  if (height == 2436) {
    // We'll save everything in the config, to keep things centralized
    let cfg = await loadConfig()
    if (cfg["phone-model"] === undefined) {
      // Doesn't exist, ask them which phone they want to generate for,
      // the mini or the others?
      message = "What model of iPhone do you have?"
      let options = ["iPhone 12 mini", "iPhone 11 Pro, XS, or X"]
      resp = await presentAlert(message, options, ALERTS_AS_SHEETS)
      // 0 represents iPhone Mini and 1 others.
      cfg["phone-model"] = resp
      await saveConfig(cfg) // Save the config
      if (resp === 0) {
        suffix = "_mini";
      }
    } else {
      // Config already contains iPhone model, use it from cfg
      if (cfg["phone-model"]) {
        suffix = "_mini";
      }
    }
  }

  let phone = phoneSizes[height + suffix]
  if (!phone) {
    message = "It looks like you selected an image that isn't an iPhone screenshot, or your iPhone is not supported. Try again with a different image."
    await presentAlert(message, ["OK"], ALERTS_AS_SHEETS)
    return false
  }

  /// hook in here
  let homeSizes = ['small', 'large']
  const homeSize = homeSizes[await presentAlert("Is your home screen set to small, or large?",
    ['Small (default)', 'Large (no text)'], ALERTS_AS_SHEETS)]

  /// build the original pre-18 structure now that we have the right size
  phone = {
    ...phone,
    ...phone[homeSize]
  }


  const families = ['small', 'medium', 'large']

  // generate crop rects for all sizes
  for (var i = 0; i < families.length; i++) {
    const widgetSize = families[i]

    let crops = widgetPositions[widgetSize].map(posName => {

      let position = posName.toLowerCase().replace(' ', '-')

      let crop = { pos: position, w: "", h: "", x: "", y: "" }
      crop.w = phone[widgetSize].w
      crop.h = phone[widgetSize].h
      crop.x = phone.left

      let pos = position.split('-')

      crop.y = phone[pos[0]]

      if (widgetSize == 'large' && pos[0] == 'bottom') {
        crop.y = phone['middle']
      }

      if (pos.length > 1) {
        crop.x = phone[pos[1]]
      }

      return crop
    })

    for (var c = 0; c < crops.length; c++) {
      const crop = crops[c]
      const imgCrop = cropImage(wallpaper, new Rect(crop.x, crop.y, crop.w, crop.h))

      const imgName = `${device_id}-${appearance}-${widgetSize}-${crop.pos}.jpg`
      const imgPath = fm.joinPath(cachePath, imgName)

      if (fm.fileExists(imgPath)) {
        // sometimes it wouldn't overwrite.
        // so better delete the file first
        if (USES_ICLOUD) await fm.downloadFileFromiCloud(imgPath)
        try { fm.remove(imgPath) } catch (e) { }
      }
      fm.writeImage(imgPath, imgCrop)

    }

  }

  if (opts.caller != 'self') {
    message = `Slices saved for ${appearance} mode. You can switch to ${altAppearance} mode and run this again to also generate slices.`
  } else {
    message = 'Slices saved.'
  }
  await presentAlert(message, ["Ok"], ALERTS_AS_SHEETS)


  return true

}
//------------------------------------------------
exports.applyTint = function (widget, tint, alpha) {
  tint = tint || '#ffffff'
  alpha = alpha || 0.2

  const col = new Color(tint, alpha)
  let gradient = new LinearGradient()
  gradient.locations = [0, 1]
  gradient.colors = [col, col]

  widget.backgroundGradient = gradient
}
//------------------------------------------------
exports.getSlice = async function (name) {
  let appearance = (await isUsingDarkAppearance())
    ? 'dark'
    : 'light'

  let position = name
  //log(position)
  const imgPath = fm.joinPath(cachePath, `${device_id}-${appearance}-${position}.jpg`)
  if (!fm.fileExists(imgPath)) {
    log('image does not exists. setup required.')
    var setupCompleted = await exports.generateSlices({ caller: 'getSliceForWidget' })
    if (!setupCompleted) {
      return null
    }
  }

  if (USES_ICLOUD) await fm.downloadFileFromiCloud(imgPath)

  let image = fm.readImage(imgPath)
  return image
}
//------------------------------------------------
exports.getPathForSlice = async function (slice_name) {
  let appearance = (await isUsingDarkAppearance())
    ? 'dark'
    : 'light'
  let imgPath = fm.joinPath(cachePath,
    `${device_id}-${appearance}-${slice_name}.jpg`)

  let fileExists = fm.fileExists(imgPath)
  if (!fileExists) {
    fileExists = await exports.generateSlices('self')
  }

  if (USES_ICLOUD && fileExists) await fm.downloadFileFromiCloud(imgPath)
  return imgPath
}
//------------------------------------------------
exports.getSliceForWidget = async function (
  instance_name,
  reset = false) {

  let appearance = (await isUsingDarkAppearance())
    ? 'dark'
    : 'light'
  var cfg = await loadConfig()
  var position = reset ? null : cfg[instance_name]
  if (!position) {
    log(`Background for "${instance_name}" is not yet set.`)

    // check if slices exists
    const testImage = fm.joinPath(cachePath, `${device_id}-${appearance}-medium-top.jpg`)
    let readyToChoose = false
    if (!fm.fileExists(testImage)) {
      // need to generate slices
      readyToChoose = await exports.generateSlices({ caller: 'self' })
    } else {
      readyToChoose = true
    }

    // now set the
    if (readyToChoose) {
      var backgrounChosen = await exports.chooseBackgroundSlice(instance_name)
    }

    if (backgrounChosen) {
      cfg = await loadConfig()
      position = cfg[instance_name]
    } else {
      return null
    }

  }
  const imgPath = fm.joinPath(cachePath, `${device_id}-${appearance}-${position}.jpg`)
  if (!fm.fileExists(imgPath)) {
    log(`Slice does not exists - ${device_id}-${appearance}-${position}.jpg`)
    return null
  }

  if (USES_ICLOUD) await fm.downloadFileFromiCloud(imgPath)

  let image = fm.readImage(imgPath)
  return image
}
//------------------------------------------------
exports.for = exports.getSliceForWidget
exports.transparent = exports.getSliceForWidget
//------------------------------------------------
exports.chooseBackgroundSlice = async function (name) {

  // Prompt for widget size and position.
  let message = "What is the size of the widget?"
  let sizes = ["Small", "Medium", "Large", "Cancel"]
  let size = await presentAlert(message, sizes, ALERTS_AS_SHEETS)
  if (size == 3) return false
  let widgetSize = sizes[size].toLowerCase()

  message = "Where will it be placed on?"
  let positions = widgetPositions[widgetSize]
  positions.push('Cancel')
  let resp = await presentAlert(message, positions, ALERTS_AS_SHEETS)

  if (resp == positions.length - 1) return false
  let position = positions[resp].toLowerCase().replace(' ', '-')

  let cfg = await loadConfig()
  cfg[name] = `${widgetSize}-${position}`

  await saveConfig(cfg)
  await presentAlert("Background saved.", ["Ok"], ALERTS_AS_SHEETS)
  return true

}
//------------------------------------------------
exports.resetConfig = async function () {
  await saveConfig({})
  log('config file cleared')
}

//-- [helpers] -----------------------------------
//------------------------------------------------
async function loadConfig() {
  const configPath = fm.joinPath(cachePath, "widget-positions.json")
  //log(` config exists == ${fm.fileExists(configPath)}`)
  if (!fm.fileExists(configPath)) {
    await fm.writeString(configPath, "{}")
    return {}
  } else {
    if (USES_ICLOUD) await fm.downloadFileFromiCloud(configPath)
    const strConf = fm.readString(configPath)
    const cfg = JSON.parse(strConf)
    return cfg
  }
}
//------------------------------------------------
async function saveConfig(cfg) {
  const configPath = fm.joinPath(
    cachePath,
    "widget-positions.json")
  if (USES_ICLOUD) {
    await fm.downloadFileFromiCloud(configPath)
  }
  await fm.writeString(configPath,
    JSON.stringify(cfg))
  return cfg
}
//------------------------------------------------
async function presentAlert(prompt = ""
  , items = ["OK"]
  , asSheet = false) {
  let alert = new Alert()
  alert.message = prompt

  for (var n = 0; n < items.length; n++) {
    alert.addAction(items[n])
  }
  let resp = asSheet
    ? await alert.presentSheet()
    : await alert.presentAlert()
  return resp
}
//------------------------------------------------
const widgetPositions = {
  "small": [
    "Top Left", "Top Right",
    "Middle Left", "Middle Right",
    "Bottom Left", "Bottom Right"
  ],
  "medium": ["Top", "Middle", "Bottom"],
  "large": ["Top", "Bottom"]
}
//------------------------------------------------
const phoneSizes = {
  "2868": {
      "models": ["16 Pro Max"],
      "small": { "w": 0, "h": 0 },
      "medium": { "w": 0, "h": 0 },
      "large": { "w": 0, "h": 0 },
      "left": 0,
      "right": 0,
      "top": 0,
      "middle": 0,
      "bottom": 0
  },
  "2622": {
      "models": ["16 Pro"],
      "small": { "w": 0, "h": 0 },
      "medium": { "w": 0, "h": 0 },
      "large": { "w": 0, "h": 0 },
      "left": 0,
      "right": 0,
      "top": 0,
      "middle": 0,
      "bottom": 0
  },
  "2796": {
    "models": ["14 Pro Max", "15 Pro Max", "15 Plus", "16 Plus"],
    "small": { "w": 510, "h": 510 },
    "medium": { "w": 1092, "h": 510 },
    "large": { "w": 1092, "h": 1146 },
    "left": 0,
    "right": 0,
    "top": 0,
    "middle": 0,
    "bottom": 0
  },

  "2556": {
    "models": ["14 Pro", "15 Pro", "15", "16"],
    "small": {
        "small": { "w": 474, "h": 474 },
        "medium": { "w": 1014, "h": 474 },
        "large": { "w": 1014, "h": 1062 },
        "left": 81,
        "right": 624,
        "top": 240,
        "middle": 828,
        "bottom": 1416
    },
    "large": {
        "small": { "w": 495, "h": 495 },
        "medium": { "w": 1047, "h": 495 },
        "large": { "w": 1047, "h": 1047 },
        "left": 66,
        "right": 618,
        "top": 243,
        "middle": 795,
        "bottom": 1347
    }
  },

  "2778": {
    "models": ["12 Pro Max", "13 Pro Max", "14 Plus"],
    "small": { "w": 510, "h": 510 },
    "medium": { "w": 1092, "h": 510 },
    "large": { "w": 1092, "h": 1146 },
    "left": 0,
    "right": 0,
    "top": 0,
    "middle": 0,
    "bottom": 0
  },

  "2532": {
    "models": ["12", "12 Pro", "13", "14"],
    "small": { "w": 474, "h": 474 },
    "medium": { "w": 1014, "h": 474 },
    "large": { "w": 1014, "h": 1062 },
    "left": 0,
    "right": 0,
    "top": 0,
    "middle": 0,
    "bottom": 0
  },

  "2688": {
    "models": ["Xs Max", "11 Pro Max"],
    "small": { "w": 507, "h": 507 },
    "medium": { "w": 1080, "h": 507 },
    "large": { "w": 1080, "h": 1137 },
    "left": 0,
    "right": 0,
    "top": 0,
    "middle": 0,
    "bottom": 0
  },

  "1792": {
    "models": ["11", "Xr"],
    "small": { "w": 338, "h": 338 },
    "medium": { "w": 720, "h": 338 },
    "large": { "w": 720, "h": 758 },
    "left": 0,
    "right": 0,
    "top": 0,
    "middle": 0,
    "bottom": 0
  },

  "2436": {
    "models": ["X", "Xs", "11 Pro"],
    "small": { "w": 465, "h": 465 },
    "medium": { "w": 987, "h": 465 },
    "large": { "w": 987, "h": 1035 },
    "left": 0,
    "right": 0,
    "top": 0,
    "middle": 0,
    "bottom": 0
  },

  "2436_mini": {
    "models": ["12 Mini"],
    "small": { "w": 465, "h": 465 },
    "medium": { "w": 987, "h": 465 },
    "large": { "w": 987, "h": 1035 },
    "left": 0,
    "right": 0,
    "top": 0,
    "middle": 0,
    "bottom": 0
  },
}
//------------------------------------------------
function cropImage(img, rect) {
  let draw = new DrawContext()
  draw.size = new Size(rect.width, rect.height)
  draw.drawImageAtPoint(img, new Point(-rect.x, -rect.y))
  return draw.getImage()
}
//------------------------------------------------
async function isUsingDarkAppearance() {
  return !(Color.dynamic(Color.white(), Color.black()).red)
}
//------------------------------------------------
function usesiCloud() {
  return module.filename
    .includes('Documents/iCloud~')
}
//------------------------------------------------
function FileManagerAdaptive() {
  return module.filename
    .includes('Documents/iCloud~')
    ? FileManager.iCloud()
    : FileManager.local()
}

module.exports = exports

// -- END OF MODULE CODE --

// if running self run config
const module_name = module.filename.match(/[^\/]+$/)[0].replace('.js', '')
if (module_name == Script.name()) {
  await(async () => {
    let opts = [
      'Generate Slices',
      'Clear Widget Positions Cache',
      'Cancel'
    ]

    let resp = await presentAlert(
      'No Background Configurator', opts, ALERTS_AS_SHEETS)
    switch (opts[resp]) {
      case 'Generate Slices':
        await exports.generateSlices({})
        break;
      case 'Clear Widget Positions Cache':
        await exports.resetConfig()
        await presentAlert('Cleared')
        break;
      default:
    }
  })()

}
