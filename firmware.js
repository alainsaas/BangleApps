require('Storage').write(".bootcde","E.setTimeZone(1);\nE.setFlags({pretokenise:1});\nvar startapp;\ntry {\n  startapp = require('Storage').readJSON('+start');\n} catch (e) {}\nif (startapp) {\n  eval(require(\"Storage\").read(startapp.src));\n} else {\n  setWatch(function displayMenu() {\n    Bangle.setLCDMode(\"direct\");\n    g.clear();\n    clearInterval();\n    clearWatch();\n    Bangle.removeAllListeners();\n\n    var s = require(\"Storage\");\n\n    apps = s.list().filter(a=>a[0]=='+').map(app=>{\n      try { return s.readJSON(app); }\n      catch (e) { return {name:\"DEAD: \"+app.substr(1)} }\n    }).filter(app=>app.type==\"app\" || app.type==\"clock\" || !app.type);\n    apps.sort((a,b)=>{\n      var n=(0|a.sortorder)-(0|b.sortorder);\n      if (n) return n; // do sortorder first\n      if (a.name<b.name) return -1;\n      if (a.name>b.name) return 1;\n      return 0;\n    });\n    var selected = 0;\n    var menuScroll = 0;\n    var menuShowing = false;\n\n    function drawMenu() {\n      g.setFont(\"6x8\",2);\n      g.setFontAlign(-1,0);\n      var n = 3;\n      if (selected>=n+menuScroll) menuScroll = 1+selected-n;\n      if (selected<menuScroll) menuScroll = selected;\n      if (menuScroll) g.fillPoly([120,0,100,20,140,20]);\n      else g.clearRect(100,0,140,20);\n      if (apps.length>n+menuScroll) g.fillPoly([120,239,100,219,140,219]);\n      else g.clearRect(100,219,140,239);\n      for (var i=0;i<n;i++) {\n        var app = apps[i+menuScroll];\n        if (!app) break;\n        var y = 24+i*64;\n        if (i+menuScroll==selected) {\n          g.setColor(0.3,0.3,0.3);\n          g.fillRect(0,y,239,y+63);\n          g.setColor(1,1,1);\n          g.drawRect(0,y,239,y+63);\n        } else\n          g.clearRect(0,y,239,y+63);\n        g.drawString(app.name,64,y+32);\n        var icon=undefined;\n        if (app.icon) icon = s.read(app.icon);\n        if (icon) try {g.drawImage(icon,8,y+8);} catch(e){}\n      }\n    }\n    drawMenu();\n    setWatch(function() {\n      if (selected>0) {\n        selected--;\n        drawMenu();\n      }\n    }, BTN1, {repeat:true});\n    setWatch(function() {\n      if (selected+1<apps.length) {\n        selected++;\n        drawMenu();\n      }\n    }, BTN3, {repeat:true});\n    setWatch(function() { // run\n      if (!apps[selected].src) return;\n      clearWatch();\n      g.clear();\n      g.setFont(\"6x8\",2);\n      g.setFontAlign(0,0);\n      g.drawString(\"Loading...\",120,120);\n      // load like this so we ensure we've cleared out our RAM\n      var cmd = 'eval(require(\"Storage\").read(\"'+apps[selected].src+'\"));';\n      setTimeout(cmd,20);\n      // re-add the menu button if we're going to the clock\n      if (apps[selected].type==\"clock\") setWatch(displayMenu, BTN2, {repeat:false});\n    }, BTN2, {repeat:true});\n  }, BTN2, {repeat:false}); // menu on middle button\n  var WIDGETPOS={tl:32,tr:g.getWidth()-32,bl:32,br:g.getWidth()-32};\n  var WIDGETS={};\n  function drawWidgets() {\n    Object.keys(WIDGETS).forEach(k=>WIDGETS[k].draw());\n  }\n\n  var clockApp = require(\"Storage\").list().filter(a=>a[0]=='+').map(app=>{\n    try { return require(\"Storage\").readJSON(app); }\n    catch (e) {}\n  }).find(app=>app.type==\"clock\");\n  if (clockApp) eval(require(\"Storage\").read(clockApp.src));\n  else E.showMessage(\"No Clock Found\");\n  delete clockApp;\n  require(\"Storage\").list().filter(a=>a[0]=='=').forEach(widget=>eval(require(\"Storage\").read(widget)));\n  setTimeout(drawWidgets,100);\n}\n");
require('Storage').write("+mclock",{"name":"Morphing Clock","type":"clock","icon":"*mclock","src":"-mclock","sortorder":-10,"files":"+mclock,-mclock,*mclock"});
require('Storage').write("-mclock","// Enable 'Set Current Time' in Settings -> Communications before sending\n(function(){ // make our own scope so this is GC'd when intervals are cleared\n// Offscreen buffer\nvar buf = Graphics.createArrayBuffer(240,86,1,{msb:true});\nfunction flip() {\n  g.setColor(1,1,1);\n  g.drawImage({width:buf.getWidth(),height:buf.getHeight(),buffer:buf.buffer},0,50);\n}\n// The last time that we displayed\nvar lastTime = \"     \";\n// If animating, this is the interval's id\nvar animInterval;\n\n/* Get array of lines from digit d to d+1.\n n is the amount (0..1)\n maxFive is true is this digit only counts 0..5 */\nconst DIGITS = {\n\" \":n=>[],\n\"0\":n=>[\n[n,0,1,0],\n[1,0,1,1],\n[1,1,1,2],\n[n,2,1,2],\n[n,1,n,2],\n[n,0,n,1]],\n\"1\":n=>[\n[1-n,0,1,0],\n[1,0,1,1],\n[1-n,1,1,1],\n[1-n,1,1-n,2],\n[1-n,2,1,2]],\n\"2\":n=>[\n[0,0,1,0],\n[1,0,1,1],\n[0,1,1,1],\n[0,1+n,0,2],\n[1,2-n,1,2],\n[0,2,1,2]],\n\"3\":n=>[\n[0,0,1-n,0],\n[0,0,0,n],\n[1,0,1,1],\n[0,1,1,1],\n[1,1,1,2],\n[n,2,1,2]],\n\"4\":n=>[\n[0,0,0,1],\n[1,0,1-n,0],\n[1,0,1,1-n],\n[0,1,1,1],\n[1,1,1,2],\n[1-n,2,1,2]],\n\"5\": (n,maxFive)=>maxFive ? [ // 5 -> 0\n[0,0,0,1],\n[0,0,1,0],\n[n,1,1,1],\n[1,1,1,2],\n[0,2,1,2],\n[0,2,0,2],\n[1,1-n,1,1],\n[0,1,0,1+n]] : [ // 5 -> 6\n[0,0,0,1],\n[0,0,1,0],\n[0,1,1,1],\n[1,1,1,2],\n[0,2,1,2],\n[0,2-n,0,2]],\n\"6\":n=>[\n[0,0,0,1-n],\n[0,0,1,0],\n[n,1,1,1],\n[1,1-n,1,1],\n[1,1,1,2],\n[n,2,1,2],\n[0,1-n,0,2-2*n]],\n\"7\":n=>[\n[0,0,0,n],\n[0,0,1,0],\n[1,0,1,1],\n[1-n,1,1,1],\n[1,1,1,2],\n[1-n,2,1,2],\n[1-n,1,1-n,2]],\n\"8\":n=>[\n[0,0,0,1],\n[0,0,1,0],\n[1,0,1,1],\n[0,1,1,1],\n[1,1,1,2],\n[0,2,1,2],\n[0,1,0,2-n]],\n\"9\":n=>[\n[0,0,0,1],\n[0,0,1,0],\n[1,0,1,1],\n[0,1,1-n,1],\n[0,1,0,1+n],\n[1,1,1,2],\n[0,2,1,2]],\n\":\":n=>[\n[0.4,0.4,0.6,0.4],\n[0.6,0.4,0.6,0.6],\n[0.6,0.6,0.4,0.6],\n[0.4,0.4,0.4,0.6],\n[0.4,1.4,0.6,1.4],\n[0.6,1.4,0.6,1.6],\n[0.6,1.6,0.4,1.6],\n[0.4,1.4,0.4,1.6]]\n};\n\n/* Draw a transition between lastText and thisText.\n 'n' is the amount - 0..1 */\nfunction draw(lastText,thisText,n) {\n  buf.clear();\n  var x = 1;  // x offset\n  const p = 2; // padding around digits\n  var y = p; // y offset\n  const s = 34; // character size\n  for (var i=0;i<lastText.length;i++) {\n    var lastCh = lastText[i];\n    var thisCh = thisText[i];\n    if (thisCh==\":\") x-=4;\n    var ch, chn = n;\n    if (lastCh!==undefined &&\n        (thisCh-1==lastCh ||\n         (thisCh==0 && lastCh==5) ||\n         (thisCh==0 && lastCh==9)))\n      ch = lastCh;\n    else {\n      ch = thisCh;\n      chn = 0;\n    }\n    var l = DIGITS[ch](chn,lastCh==5 && thisCh==0);\n    l.forEach(c=>{\n      if (c[0]!=c[2]) // horiz\n        buf.fillRect(x+c[0]*s,y+c[1]*s-p,x+c[2]*s,y+c[3]*s+p);\n      else if (c[1]!=c[3]) // vert\n        buf.fillRect(x+c[0]*s-p,y+c[1]*s,x+c[2]*s+p,y+c[3]*s);\n    });\n    if (thisCh==\":\") x-=4;\n    x+=s+p+7;\n  }\n  y += 2*s;\n  var d = new Date();\n  buf.setFont(\"6x8\");\n  buf.setFontAlign(-1,-1);\n  buf.drawString((\"0\"+d.getSeconds()).substr(-2), x, y-8);\n  // date\n  buf.setFontAlign(0,-1);\n  var date = d.toString().substr(0,15);\n  buf.drawString(date, buf.getWidth()/2, y+8);\n  flip();\n}\n\n/* Show the current time, and animate if needed */\nfunction showTime() {\n  if (!Bangle.isLCDOn()) return;\n  if (animInterval) return; // in animation - quit\n  var d = new Date();\n  var t = (\" \"+d.getHours()).substr(-2)+\":\"+\n          (\"0\"+d.getMinutes()).substr(-2);\n  var l = lastTime;\n  // same - don't animate\n  if (t==l) {\n    draw(t,l,0);\n    return;\n  }\n  var n = 0;\n  animInterval = setInterval(function() {\n    n += 1/10;\n    if (n>=1) {\n      n=1;\n      clearInterval(animInterval);\n      animInterval=0;\n    }\n    draw(l,t,n);\n  }, 20);\n  lastTime = t;\n}\n\nBangle.on('lcdPower',function(on) {\n  if (on) {\n    showTime();\n    drawWidgets();\n  }\n});\n\ng.clear();\n// Update time once a second\nsetInterval(showTime, 1000);\nshowTime();\n})();\n");
require('Storage').write("*mclock",require("heatshrink").decompress(atob("mEwghC/AE8IxAAEwAWVDB4WIDBwWJAAIWPmf//8zDBpFDwYVBAAc4JJYWJDAoXKn4SC+EPAgXzC5JGCx4qDC4n//BIIEIRCEC4v/GBBdHC4xhCIw5dDC5BhCJAgXCRQoXGJAQXEUhAXHJAyNGC5KRCC7p2FC5B4CC5kggQXOBwvyBQMvSA4XL+EIwCoIC8ZHCgYXNO44LBBIiPPCAIwFC5DXGAAMwGAjvPGA4XIwYXHGALBDnAXFhCQHGAaOFwAXGPA4bFC4xIMIxIXDJBJGEC4xICSJCNEIwowEMJBdCFwwXEMJBdCC5BICDA4WDIw4wEAAMzCoMzBAgWIDAwAGCxRJEAAxFJDBgWNDBAWPAH4AYA==")));
require('Storage').write("+setting",{"name":"Settings","type":"app","icon":"*settings","src":"-settings","files":"+setting,-setting,=setting,@setting,*setting"});
require('Storage').write("-setting","Bangle.setLCDPower(1);\nBangle.setLCDTimeout(0);\n\ng.clear();\nconst storage = require('Storage');\nlet settings;\n\nfunction debug(msg, arg) {\n  if (settings.debug)\n    console.log(msg, arg);\n}\n\nfunction updateSettings() {\n  debug('updating settings', settings);\n  //storage.erase('@setting'); // - not needed, just causes extra writes if settings were the same\n  storage.write('@setting', settings);\n}\n\nfunction resetSettings() {\n  settings = {\n    ble: false,\n    dev: false,\n    timeout: 10,\n    vibrate: true,\n    beep: true,\n    timezone: 0,\n    HID : false,\n    HIDGestures: false,\n    debug: false,\n  };\n  setLCDTimeout(settings.timeout);\n  updateSettings();\n}\n\ntry {\n  settings = storage.readJSON('@setting');\n} catch (e) {}\nif (!settings) resetSettings();\n\nconst boolFormat = (v) => v ? \"On\" : \"Off\";\n\nfunction showMainMenu() {\n  const mainmenu = {\n    '': { 'title': 'Settings' },\n    'BLE': {\n      value: settings.ble,\n      format: boolFormat,\n      onchange: () => {\n        settings.ble = !settings.ble;\n        updateSettings();\n      }\n    },\n    'Dev': {\n      value: settings.dev,\n      format: boolFormat,\n      onchange: () => {\n        settings.dev = !settings.dev;\n        updateSettings();\n      }\n    },\n    'LCD Timeout': {\n      value: settings.timeout,\n      min: 0,\n      max: 60,\n      step: 5,\n      onchange: v => {\n        settings.timeout = 0 | v;\n        updateSettings();\n        Bangle.setLCDTimeout(settings.timeout);\n      }\n    },\n    'Beep': {\n      value: settings.beep,\n      format: boolFormat,\n      onchange: () => {\n        settings.beep = !settings.beep;\n        updateSettings();\n        if (settings.beep) {\n          Bangle.beep(1);\n        }\n      }\n    },\n    'Vibration': {\n      value: settings.vibrate,\n      format: boolFormat,\n      onchange: () => {\n        settings.vibrate = !settings.vibrate;\n        updateSettings();\n        if (settings.vibrate) {\n          VIBRATE.write(1);\n          setTimeout(()=>VIBRATE.write(0), 10);\n        }\n      }\n    },\n    'Time Zone': {\n      value: settings.timezone,\n      min: -11,\n      max: 12,\n      step: 1,\n      onchange: v => {\n        settings.timezone = 0 | v;\n        updateSettings();\n      }\n    },\n    'HID': {\n      value: settings.HID,\n      format: boolFormat,\n      onchange: () => {\n        settings.HID = !settings.HID;\n        updateSettings();\n      }\n    },\n    'HID Gestures': {\n      value: settings.HIDGestures,\n      format: boolFormat,\n      onchange: () => {\n        settings.HIDGestures = !settings.HIDGestures;\n        updateSettings();\n      }\n    },\n    'Debug': {\n      value: settings.debug,\n      format: boolFormat,\n      onchange: () => {\n        settings.debug = !settings.debug;\n        updateSettings();\n      }\n    },\n    'Set Time': showSetTimeMenu,\n    'Make Connectable': makeConnectable,\n    'Reset Settings': showResetMenu,\n    'Turn Off': Bangle.off,\n    '< Back': load\n  };\n  return Bangle.menu(mainmenu);\n}\n\nfunction showResetMenu() {\n  const resetmenu = {\n    '': { 'title': 'Reset' },\n    '< Back': showMainMenu,\n    'Reset Settings': () => {\n      E.showPrompt('Reset Settings?').then((v) => {\n        if (v) {\n          E.showMessage('Resetting');\n          resetSettings();\n        }\n        setTimeout(showMainMenu, 50);\n      });\n    },\n    // this is include for debugging. remove for production\n    /*'Erase': () => {\n      storage.erase('=setting');\n      storage.erase('-setting');\n      storage.erase('@setting');\n      storage.erase('*setting');\n      storage.erase('+setting');\n      E.reboot();\n    }*/\n  };\n  return Bangle.menu(resetmenu);\n}\n\nfunction makeConnectable() {\n  try { NRF.wake(); } catch(e) {}\n  var name=\"Bangle.js \"+NRF.getAddress().substr(-5).replace(\":\",\"\");\n  E.showPrompt(name+\"\\nStay Connectable?\",{title:\"Connectable\"}).then(r=>{\n    if (settings.ble!=r) {\n      settings.ble = r;\n      updateSettings();\n    }\n    if (!r) try { NRF.sleep(); } catch(e) {}\n    showMainMenu();\n  });\n}\n\nfunction showSetTimeMenu() {\n  d = new Date();\n  const timemenu = {\n    '': {\n      'title': 'Set Time',\n      'predraw': function() {\n        d = new Date();\n        timemenu.Hour.value = d.getHours();\n        timemenu.Minute.value = d.getMinutes();\n        timemenu.Second.value = d.getSeconds();\n        timemenu.Date.value = d.getDate();\n        timemenu.Month.value = d.getMonth() + 1;\n        timemenu.Year.value = d.getFullYear();\n      }\n    },\n    '< Back': showMainMenu,\n    'Hour': {\n      value: d.getHours(),\n      min: 0,\n      max: 23,\n      step: 1,\n      onchange: v => {\n        d = new Date();\n        d.setHours(v);\n        setTime(d.getTime()/1000);\n      }\n    },\n    'Minute': {\n      value: d.getMinutes(),\n      min: 0,\n      max: 59,\n      step: 1,\n      onchange: v => {\n        d = new Date();\n        d.setMinutes(v);\n        setTime(d.getTime()/1000);\n      }\n    },\n    'Second': {\n      value: d.getSeconds(),\n      min: 0,\n      max: 59,\n      step: 1,\n      onchange: v => {\n        d = new Date();\n        d.setSeconds(v);\n        setTime(d.getTime()/1000);\n      }\n    },\n    'Date': {\n      value: d.getDate(),\n      min: 1,\n      max: 31,\n      step: 1,\n      onchange: v => {\n        d = new Date();\n        d.setDate(v);\n        setTime(d.getTime()/1000);\n      }\n    },\n    'Month': {\n      value: d.getMonth() + 1,\n      min: 1,\n      max: 12,\n      step: 1,\n      onchange: v => {\n        d = new Date();\n        d.setMonth(v - 1);\n        setTime(d.getTime()/1000);\n      }\n    },\n    'Year': {\n      value: d.getFullYear(),\n      min: d.getFullYear() - 10,\n      max: d.getFullYear() + 10,\n      step: 1,\n      onchange: v => {\n        d = new Date();\n        d.setFullYear(v);\n        setTime(d.getTime()/1000);\n      }\n    }\n  };\n  return Bangle.menu(timemenu);\n}\n\nshowMainMenu();\n");
require('Storage').write("=setting","// Report from https://notes.iopush.net/custom-usb-hid-device-descriptor-media-keyboard/\n/*Bangle.HID = new Uint8Array([\n  // Keyboard Controls\n  0x05, 0x01,\n  0x09, 0x06,\n  0xA1, 0x01,\n  0x85, 0x02,\n  0x05, 0x07,\n  0x19, 0xe0,\n  0x29, 0xe7,\n  0x15, 0x00,\n  0x25, 0x01,\n  0x75, 0x01,\n  0x95, 0x08,\n  0x81, 0x02,\n  0x95, 0x01,\n  0x75, 0x08,\n  0x81, 0x01,\n  0x95, 0x05,\n  0x75, 0x01,\n  0x05, 0x08,\n  0x19, 0x01,\n  0x29, 0x05,\n  0x91, 0x02,\n  0x95, 0x01,\n  0x75, 0x03,\n  0x91, 0x01,\n  0x95, 0x06,\n  0x75, 0x08,\n  0x15, 0x00,\n  0x25, 0x73,\n  0x05, 0x07,\n  0x19, 0x00,\n  0x29, 0x73,\n  0x81, 0x00,\n  0x09, 0x05,\n  0x15, 0x00,\n  0x26, 0xFF, 0x00,\n  0x75, 0x08,\n  0x95, 0x02,\n  0xB1, 0x02,\n  0xC0,\n\n  // Music Controls\n  0x05, 0x0C,\n  0x09, 0x01,\n  0xA1, 0x01,\n  0x85, 0x01,\n  0x15, 0x00,\n  0x25, 0x01,\n  0x75, 0x01,\n  0x95, 0x01,\n  0x09, 0xB5,\n  0x81, 0x02,\n  0x09, 0xB6,\n  0x81, 0x02,\n  0x09, 0xB7,\n  0x81, 0x02,\n  0x09, 0xB8,\n  0x81, 0x02,\n  0x09, 0xCD,\n  0x81, 0x02,\n  0x09, 0xE2,\n  0x81, 0x02,\n  0x09, 0xE9,\n  0x81, 0x02,\n  0x09, 0xEA,\n  0x81, 0x02,\n  0xC0\n]);*/\n// More compact HID representation\nBangle.HID = E.toUint8Array(atob(\"BQEJBqEBhQIFBxngKecVACUBdQGVCIEClQF1CIEBlQV1AQUIGQEpBZEClQF1A5EBlQZ1CBUAJXMFBxkAKXOBAAkFFQAm/wB1CJUCsQLABQwJAaEBhQEVACUBdQGVAQm1gQIJtoECCbeBAgm4gQIJzYECCeKBAgnpgQIJ6oECwA==\"));\n(function() {\n  var s = require('Storage').readJSON('@setting');\n  if (s.ble) {\n    if (s.dev)\n      Bluetooth.setConsole();\n    else\n      LoopbackA.setConsole(true);\n    var adv = { uart: true };\n    if (s.HID) {\n      adv.hid = Bangle.HID;\n    } else\n      delete Bangle.HID;\n    NRF.setServices({}, adv);\n    try {\n      NRF.wake();\n    } catch (e) {}\n  } else {\n    NRF.sleep();\n  }\n\n  if (!s.vibrate) Bangle.buzz=()=>Promise.resolve();\n  if (!s.beep) Bangle.beep=()=>Promise.resolve();\n  Bangle.setLCDTimeout(s.timeout);\n  if (!s.timeout) Bangle.setLCDPower(1);\n  E.setTimeZone(s.timezone);\n})()\n");
require('Storage').write("@setting",{
  ble: false,          // Bluetooth disabled by default
  dev: false,          // Espruino IDE disabled by default
  timeout: 10,         // Default LCD timeout in seconds
  vibrate: true,       // Vibration enabled by default. App must support
  beep: true,          // Beep enabled by default. App must support
  timezone: 0,         // Set the timezone for the device
  HID : false,         // BLE HID mode, off by default
  HIDGestures: false,
  debug: false,        // Debug mode disabled by default. App must support
});
require('Storage').write("*setting",require("heatshrink").decompress(atob("mEwghC/AFEiAAgX/C/4SFkADBgQXFBIgECAAYSCkAWGBIoXGyQTHABBZLkUhiMRiQXLIQwVBAAZlIC44tCAAYxGIxIWFGA4XIFwwwHXBAWHGAwXHFxAwGPAYXTX44XDiAJBgIXGyDAHFAYKDMAq+EGAgXNCwwX/C453XU6IWHa6ZFCC6JJCC4hgEAAoOEC5AwIFwhgEBAgwIBoqmGGBIuFVAgXFGAwLFYAoLFGIYtFeA4MGABMpC4pICkBMGBIpGFC4SuIBIoWFAAxZLC/4X/AFQ")));
require('Storage').write("+trex",{"name":"T-Rex","type":"app","icon":"*trex","src":"-trex","files":"+trex,-trex,*trex"});
require('Storage').write("-trex","greal = g;\ng.clear();\ng = Graphics.createArrayBuffer(120,64,1,{msb:true});\ng.flip = function() {\n  greal.drawImage({\n    width:120,\n    height:64,\n    buffer:g.buffer\n  },0,(240-128)/2,{scale:2});\n};\nvar W = g.getWidth();\nvar BTNL = BTN4;\nvar BTNR = BTN5;\nvar BTNU = BTN1;\n\n// Images can be added like this in Espruino v2.00\nvar IMG = {\n  rex: [Graphics.createImage(`\n           ########\n          ##########\n          ## #######\n          ##########\n          ##########\n          ##########\n          #####\n          ########\n#        #####\n#      #######\n##    ##########\n###  ######### #\n##############\n##############\n ############\n  ###########\n   #########\n    #######\n     ### ##\n     ##   #\n          #\n          ##\n`),Graphics.createImage(`\n           ########\n          ##########\n          ## #######\n          ##########\n          ##########\n          ##########\n          #####\n          ########\n#        #####\n#      #######\n##    ##########\n###  ######### #\n##############\n##############\n ############\n  ###########\n   #########\n    #######\n     ### ##\n     ##   ##\n     #\n     ##\n`),Graphics.createImage(`\n           ########\n          #   ######\n          # # ######\n          #   ######\n          ##########\n          ##########\n          #####\n          ########\n#        #####\n#      #######\n##    ##########\n###  ######### #\n##############\n##############\n ############\n  ###########\n   #########\n    #######\n     ### ##\n     ##   #\n     #    #\n     ##   ##\n`)],\n  cacti: [Graphics.createImage(`\n     ##\n    ####\n    ####\n    ####\n    ####\n    ####  #\n #  #### ###\n### #### ###\n### #### ###\n### #### ###\n### #### ###\n### #### ###\n### #### ###\n### #### ###\n###########\n #########\n    ####\n    ####\n    ####\n    ####\n    ####\n    ####\n    ####\n    ####\n`),Graphics.createImage(`\n   ##\n   ##\n # ##\n## ##  #\n## ##  #\n## ##  #\n## ##  #\n#####  #\n ####  #\n   #####\n   ####\n   ##\n   ##\n   ##\n   ##\n   ##\n   ##\n   ##\n`)],\n};\nIMG.rex.forEach(i=>i.transparent=0);\nIMG.cacti.forEach(i=>i.transparent=0);\nvar cacti, rex, frame;\n\nfunction gameStart() {\n  rex = {\n    alive : true,\n    img : 0,\n    x : 10, y : 0,\n    vy : 0,\n    score : 0\n  };\n  cacti = [ { x:W, img:1 } ];\n  var random = new Uint8Array(128*3/8);\n  for (var i=0;i<50;i++) {\n    var a = 0|(Math.random()*random.length);\n    var b = 0|(Math.random()*8);\n    random[a]|=1<<b;\n  }\n  IMG.ground = { width: 128, height: 3, bpp : 1, buffer : random.buffer };\n  frame = 0;\n  setInterval(onFrame, 50);\n}\nfunction gameStop() {\n  rex.alive = false;\n  rex.img = 2; // dead\n  clearInterval();\n  setTimeout(function() {\n    setWatch(gameStart, BTNU, {repeat:0,debounce:50,edge:\"rising\"});\n  }, 1000);\n  setTimeout(onFrame, 10);\n}\n\nfunction onFrame() {\n  g.clear();\n  if (rex.alive) {\n    frame++;\n    rex.score++;\n    if (!(frame&3)) rex.img = rex.img?0:1;\n    // move rex\n    if (BTNL.read() && rex.x>0) rex.x--;\n    if (BTNR.read() && rex.x<20) rex.x++;\n    if (BTNU.read() && rex.y==0) rex.vy=4;\n    rex.y += rex.vy;\n    rex.vy -= 0.2;\n    if (rex.y<=0) {rex.y=0; rex.vy=0; }\n    // move cacti\n    var lastCactix = cacti.length?cacti[cacti.length-1].x:W-1;\n    if (lastCactix<W) {\n      cacti.push({\n        x : lastCactix + 24 + Math.random()*W,\n        img : (Math.random()>0.5)?1:0\n      });\n    }\n    cacti.forEach(c=>c.x--);\n    while (cacti.length && cacti[0].x<0) cacti.shift();\n  } else {\n    g.drawString(\"Game Over!\",(W-g.stringWidth(\"Game Over!\"))/2,20);\n  }\n  g.drawLine(0,60,239,60);\n  cacti.forEach(c=>g.drawImage(IMG.cacti[c.img],c.x,60-IMG.cacti[c.img].height));\n  // check against actual pixels\n  var rexx = rex.x;\n  var rexy = 38-rex.y;\n  if (rex.alive &&\n     (g.getPixel(rexx+0, rexy+13) ||\n      g.getPixel(rexx+2, rexy+15) ||\n      g.getPixel(rexx+5, rexy+19) ||\n      g.getPixel(rexx+10, rexy+19) ||\n      g.getPixel(rexx+12, rexy+15) ||\n      g.getPixel(rexx+13, rexy+13) ||\n      g.getPixel(rexx+15, rexy+11) ||\n      g.getPixel(rexx+17, rexy+7) ||\n      g.getPixel(rexx+19, rexy+5) ||\n      g.getPixel(rexx+19, rexy+1))) {\n    return gameStop();\n  }\n  g.drawImage(IMG.rex[rex.img], rexx, rexy);\n  var groundOffset = frame&127;\n  g.drawImage(IMG.ground, -groundOffset, 61);\n  g.drawImage(IMG.ground, 128-groundOffset, 61);\n  g.drawString(rex.score,(W-1)-g.stringWidth(rex.score));\n  g.flip();\n}\n\ngameStart();\n");
require('Storage').write("*trex",require("heatshrink").decompress(atob("mEwgIXUn//4AFI///+AFC+YFKCIoFeHQYFH/4FGhkAgYKCAo8fApEPGggFG4YFBmAFHAgIdDAqA/BAo38K4gFJWIJ7DAoUB/AqC4EDLwIFCh0GFQPD4EYgP/4YABDwfwSggFFgAFCgOAAoYSDAox4BABQA==")));
require('Storage').write("+gpstime",{"name":"GPS Time","type":"app","icon":"*gpstime","src":"-gpstime","files":"+gpstime,-gpstime,*gpstime"});
require('Storage').write("-gpstime","var img = require(\"heatshrink\").decompress(atob(\"mEwghC/AH8A1QWVhWq0AuVAAIuVAAIwT1WinQwTFwMzmQwTCYMjlUqGCIuBlWi0UzC6JdBIoMjC4UDmAuOkYXBPAWgmczLp2ilUiVAUDC4IwLFwIUBLoJ2BFwQwM1WjCgJ1DFwQwLFwJ1B0SQCkQWDGBQXBCgK9BDgKQBAAgwJOwUzRgIDBC54wCkZdGPBwACRgguDBIIwLFxEJBQIwLFxGaBYQwKFxQwLgAWGmQuBcAQwJC48ifYYwJgUidgsyC4L7DGBIXBdohnBCgL7BcYIXIGAqMCIoL7DL5IwERgIUBLoL7BO5QXBGAK7DkWiOxQXGFwOjFoUyFxZhDgBdCCgJ1CCxYxCgBABkcqOwIuNGAQXC0S9BLpgAFXoIwBmYuPAAYwCLp4wHFyYwDFyYwDFygwCCyoA/AFQA=\"));\n\nBangle.setLCDPower(1);\nBangle.setLCDTimeout(0);\n\ng.clear();\n\n\n\nvar fix;\nBangle.on('GPS',function(f) {\n  fix = f;\n  g.setFont(\"6x8\",2);\n  g.setFontAlign(0,0);\n  g.clearRect(90,30,239,90);\n  if (fix.fix) {\n    g.drawString(\"GPS\",170,40);\n    g.drawString(\"Acquired\",170,60);\n  } else {\n    g.drawString(\"Waiting for\",170,40);\n    g.drawString(\"GPS Fix\",170,60);\n  }\n  g.setFont(\"6x8\");\n  g.drawString(fix.satellites+\" satellites\",170,80);\n  \n  g.clearRect(0,100,239,239);\n  var t = fix.time.toString().split(\" \");/*\n [\n  \"Sun\",\n  \"Nov\",\n  \"10\",\n  \"2019\",\n  \"15:55:35\",\n  \"GMT+0100\"\n ]\n  */\n  //g.setFont(\"6x8\",2);\n  //g.drawString(t[0],120,110); // day\n  g.setFont(\"6x8\",3);\n  g.drawString(t[1]+\" \"+t[2],120,135); // date\n  g.setFont(\"6x8\",2);\n  g.drawString(t[3],120,160); // year\n  g.setFont(\"6x8\",3);\n  g.drawString(t[4],120,185); // time\n  // timezone\n  var tz = (new Date()).getTimezoneOffset()/60;\n  if (tz==0) tz=\"UTC\";\n  else if (tz>0) tz=\"UTC+\"+tz;\n  else tz=\"UTC\"+tz;\n  g.setFont(\"6x8\",2);\n  g.drawString(tz,120,210); // gmt\n  g.setFontAlign(0,0,3);\n  g.drawString(\"Set\",230,120);\n  g.setFontAlign(0,0);\n});\n\nsetInterval(function() {\n  g.drawImage(img,48,48,{scale:1.5,rotate:Math.sin(getTime()*2)/2});\n},100);\nsetWatch(function() {\n  setTime(fix.time.getTime()/1000);\n}, BTN2, {repeat:true});\n\nBangle.setGPSPower(1)\n");
require('Storage').write("*gpstime",require("heatshrink").decompress(atob("mEwghC/AH8A1QWVhWq0AuVAAIuVAAIwT1WinQwTFwMzmQwTCYMjlUqGCIuBlWi0UzC6JdBIoMjC4UDmAuOkYXBPAWgmczLp2ilUiVAUDC4IwLFwIUBLoJ2BFwQwM1WjCgJ1DFwQwLFwJ1B0SQCkQWDGBQXBCgK9BDgKQBAAgwJOwUzRgIDBC54wCkZdGPBwACRgguDBIIwLFxEJBQIwLFxGaBYQwKFxQwLgAWGmQuBcAQwJC48ifYYwJgUidgsyC4L7DGBIXBdohnBCgL7BcYIXIGAqMCIoL7DL5IwERgIUBLoL7BO5QXBGAK7DkWiOxQXGFwOjFoUyFxZhDgBdCCgJ1CCxYxCgBABkcqOwIuNGAQXC0S9BLpgAFXoIwBmYuPAAYwCLp4wHFyYwDFyYwDFygwCCyoA/AFQA=")));
require('Storage').write("+compass",{"name":"Compass","type":"app","icon":"*compass","src":"-compass","files":"+compass,-compass,*compass"});
require('Storage').write("-compass","g.clear();\ng.setColor(0,0.5,1);\ng.fillCircle(120,130,80,80);\ng.setColor(0,0,0);\ng.fillCircle(120,130,70,70);\n\nfunction arrow(r,c) {\n  r=r*Math.PI/180;\n  var p = Math.PI/2;\n  g.setColor(c);\n  g.fillPoly([\n    120+60*Math.sin(r), 130-60*Math.cos(r),\n    120+10*Math.sin(r+p), 130-10*Math.cos(r+p),\n    120+10*Math.sin(r+-p), 130-10*Math.cos(r-p),\n    ]);\n}\n\nvar oldHeading = 0;\nBangle.on('mag', function(m) {\n  if (!Bangle.isLCDOn()) return;\n  g.setFont(\"6x8\",3);\n  g.setColor(0);\n  g.fillRect(70,0,170,24);\n  g.setColor(0xffff);\n  g.setFontAlign(0,0);\n  g.drawString((m.heading===undefined)?\"---\":Math.round(m.heading),120,12);\n  g.setColor(0,0,0);\n  arrow(oldHeading,0);\n  arrow(oldHeading+180,0);\n  arrow(m.heading,0xF800);\n  arrow(m.heading+180,0x001F);\n  oldHeading = m.heading;\n});\nBangle.setCompassPower(1);\n");
require('Storage').write("*compass",require("heatshrink").decompress(atob("mEwghC/AE8IxAAEwAWVDB4WIDBwWJAAIWOwcz///mc4DBhFDwYVBAAYYDJJAWJDAoXKCw//+YXJIwWPCQk/Aof4JBAuHC4v/GBBdHC4nzMIZGHCAIOBC4vz75hDJAgXCCgS9CC4fdAYQXGIwsyCAPyl//nvdVQoXFRofzkYXCCwJGBSIgXFQ4kymcykfdIwZgDC5XzkUyCwJGDC6FNCwPTC5i9FmQXCMgLZFC48zLgMilUv/vdkUjBII9BC6HSC55HD1WiklDNIgXIBok61QYBkSBFC5kqCwMjC6RGB1RcCR4gXIx4MC+Wqkfyl70BEQf4C4+DIwYqBC4XzGAc4C4sISAfz0QDCFgUzRwmAC4wQB+QTCC4f/AYJeCC4hIEPQi9FIwwXDbIzVHC4xICSIYXGRoRGFGAgqFXgouGC4iqDLo4XIJAQYHCwZGHGAgYBXQUzCwYuIDAwAHCxRJEAAxFJDBgWNDBAWPAH4AYA=")));
require('Storage').write("+sbat",{"name":"Battery Level","type":"widget","src":"=sbat","files":"+sbat,=sbat"});
require('Storage').write("=sbat","(function(){\nvar img_charge = E.toArrayBuffer(atob(\"DhgBHOBzgc4HOP////////////////////3/4HgB4AeAHgB4AeAHgB4AeAHg\"));\nvar xpos = WIDGETPOS.tr-64;\nWIDGETPOS.tr-=68;\n\nfunction draw() {\n  var s = 63;\n  var x = xpos, y = 0;\n  g.clearRect(x,y,x+s,y+23);\n  if (Bangle.isCharging()) {\n    g.drawImage(img_charge,x,y);\n    x+=16;\n    s-=16;\n  }\n  g.setColor(1,1,1);\n  g.fillRect(x,y+2,x+s-4,y+21);\n  g.clearRect(x+2,y+4,x+s-6,y+19);\n  g.fillRect(x+s-3,y+10,x+s,y+14);\n  g.fillRect(x+4,y+6,x+4+E.getBattery()*(s-12)/100,y+17);\n  g.setColor(1,1,1);\n}\nBangle.on('charging',function(charging) { draw(); g.flip(); if(charging)Bangle.buzz(); });\nWIDGETS[\"battery\"]={draw:draw};\n})()\n");
require('Storage').write("+funrun5",{"name":"5K Fun Run","type":"app","icon":"*funrun5","src":"-funrun5","sortorder":-1,"files":"+funrun5,-funrun5,*funrun5"});
require('Storage').write("-funrun5","var coordScale = 0.6068;\r\nvar coords = new Int32Array([-807016,6918514,-807057,6918544,-807135,6918582,-807238,6918630,-807289,6918646,-807308,6918663,-807376,6918755,-807413,6918852,-807454,6919002,-807482,6919080,-807509,6919158,-807523,6919221,-807538,6919256,-807578,6919336,-807628,6919447,-807634,6919485,-807640,6919505,-807671,6919531,-807703,6919558,-807760,6919613,-807752,6919623,-807772,6919643,-807802,6919665,-807807,6919670,-807811,6919685,-807919,6919656,-807919,6919645,-807890,6919584,-807858,6919533,-807897,6919503,-807951,6919463,-807929,6919430,-807916,6919412,-807907,6919382,-807901,6919347,-807893,6919322,-807878,6919292,-807858,6919274,-807890,6919232,-807909,6919217,-807938,6919206,-807988,6919180,-807940,6919127,-807921,6919100,-807908,6919072,-807903,6919039,-807899,6919006,-807911,6918947,-807907,6918936,-807898,6918905,-807881,6918911,-807874,6918843,-807870,6918821,-807854,6918775,-807811,6918684,-807768,6918593,-807767,6918593,-807729,6918516,-807726,6918505,-807726,6918498,-807739,6918481,-807718,6918465,-807697,6918443,-807616,6918355,-807518,6918263,-807459,6918191,-807492,6918162,-807494,6918147,-807499,6918142,-807500,6918142,-807622,6918041,-807558,6917962,-807520,6917901,-807475,6917933,-807402,6917995,-807381,6918024,-807361,6918068,-807323,6918028,-807262,6918061,-807263,6918061,-807159,6918116,-807148,6918056,-807028,6918063,-807030,6918063,-806979,6918068,-806892,6918090,-806760,6918115,-806628,6918140,-806556,6918162,-806545,6918175,-806531,6918173,-806477,6918169,-806424,6918180,-806425,6918180,-806367,6918195,-806339,6918197,-806309,6918191,-806282,6918182,-806248,6918160,-806225,6918136,-806204,6918107,-806190,6918076,-806169,6917968,-806167,6917953,-806157,6917925,-806140,6917896,-806087,6917839,-806071,6917824,-805969,6917904,-805867,6917983,-805765,6918063,-805659,6918096,-805677,6918131,-805676,6918131,-805717,6918212,-805757,6918294,-805798,6918397,-805827,6918459,-805877,6918557,-805930,6918608,-805965,6918619,-806037,6918646,-806149,6918676,-806196,6918685,-806324,6918703,-806480,6918735,-806528,6918738,-806644,6918712,-806792,6918667,-806846,6918659,-806914,6918654,-806945,6918661,-806971,6918676,-806993,6918689,-806992,6918692,-807065,6918753,-807086,6918786,-807094,6918788,-807102,6918795,-807104,6918793,-807107,6918799,-807102,6918802,-807112,6918812,-807106,6918815,-807115,6918826,-807120,6918823,-807132,6918841,-807141,6918850,-807151,6918841,-807170,6918832,-807193,6918813,-807222,6918775,-807246,6918718,-807250,6918694,-807264,6918637,-807238,6918630,-807148,6918587,-807057,6918544,-806948,6918463]);\r\n\r\nvar min = {\"x\":-807988,\"y\":6917824};\r\nvar max = {\"x\":-805659,\"y\":6919685};\r\nvar gcoords = new Uint8Array(coords.length);\r\nvar coordDistance = new Uint16Array(coords.length/2);\r\n\r\nvar PT_DISTANCE = 30; // distance to a point before we consider it complete\r\n\r\nfunction toScr(p) {\r\n  return {\r\n    x : 10 + (p.x-min.x)*100/(max.x-min.x),\r\n    y : 230 - (p.y-min.y)*100/(max.y-min.y)\r\n  };\r\n}\r\n\r\nvar last;\r\nvar totalDistance = 0;\r\nfor (var i=0;i<coords.length;i+=2) {\r\n  var c = {x:coords[i],y:coords[i+1]};\r\n  var s = toScr(c);\r\n  gcoords[i  ] = s.x;\r\n  gcoords[i+1] = s.y;\r\n  if (last) {\r\n    var dx = c.x-last.x;\r\n    var dy = c.y-last.y;\r\n    totalDistance += Math.sqrt(dx*dx+dy*dy)*coordScale;\r\n    coordDistance[i/2] = totalDistance;\r\n  }\r\n  last = c;\r\n}\r\nvar fix, lastFix;\r\nvar nextPtIdx = 0; // 2x the number of points\r\nvar nextPt = {x:coords[nextPtIdx], y:coords[nextPtIdx+1]};\r\nvar nextAngle = 0;\r\nvar nextDist = 0;\r\nvar currentDist = 0;\r\n\r\n\r\n\r\nfunction drawMap() {\r\n  g.clearRect(0,0,239,120);\r\n  g.setFontAlign(0,0);\r\n  g.setColor(1,0,0);\r\n  g.setFontVector(40);\r\n  g.drawString((currentDist===undefined)?\"?\":(Math.round(currentDist)+\"m\"), 160, 30);\r\n  g.setColor(1,1,1);\r\n  g.setFont(\"6x8\",2);\r\n  g.drawString(Math.round(totalDistance)+\"m\", 160, 70);\r\n  g.drawString((nextPtIdx/2)+\"/\"+coordDistance.length, 50, 20);\r\n  if (!fix.fix) {\r\n    g.setColor(1,0,0);\r\n    g.drawString(\"No GPS\", 50, 50);\r\n    g.setFont(\"6x8\",1);\r\n    g.drawString(fix.satellites+\" Sats\", 50, 70);\r\n  }\r\n\r\n  if (lastFix && lastFix.fix) {\r\n    g.setColor(0,0,0);\r\n    g.drawCircle(lastFix.s.x,lastFix.s.y,10);\r\n  }\r\n  for (var i=0;i<gcoords.length;i+=2) {\r\n    g.setColor((i<=nextPtIdx) ? 63488 : 46486); // red/grey\r\n    g.fillRect(gcoords[i]-2,gcoords[i+1]-2,gcoords[i]+2,gcoords[i+1]+2);\r\n  }\r\n  g.setColor(1,0,0); // first part of path\r\n  g.drawPoly(new Uint8Array(gcoords.buffer, 0, nextPtIdx+2));\r\n  g.setColor(1,1,1); // remaining part of path\r\n  g.drawPoly(new Uint8Array(gcoords.buffer, nextPtIdx));\r\n\r\n  if (fix && fix.fix) {\r\n    g.setColor(1,0,0);\r\n    g.drawCircle(fix.s.x,fix.s.y,10);\r\n  }\r\n  lastFix = fix;\r\n}\r\n\r\nfunction getNextPtInfo() {\r\n  var dx = nextPt.x - fix.p.x;\r\n  var dy = nextPt.y - fix.p.y;\r\n  nextAngle = Math.atan2(dx,dy)*180/Math.PI;\r\n  nextDist = Math.sqrt(dx*dx+dy*dy)*coordScale;\r\n}\r\n\r\nfunction onGPS(f) {\r\n  fix = f;\r\n  fix.p = Bangle.project(fix);\r\n  fix.s = toScr(fix.p);\r\n  getNextPtInfo();\r\n  if ((nextDist < PT_DISTANCE) &&\r\n      (nextPtIdx < coords.length)) {\r\n    nextPtIdx+=2;\r\n    nextPt = {x:coords[nextPtIdx], y:coords[nextPtIdx+1]};\r\n    getNextPtInfo();\r\n  }\r\n  // work out how far we are (based on distance to next point)\r\n  if (!fix.fix) {\r\n    currentDist = undefined\r\n  } else if (nextPtIdx+2 < coordDistance.length) {\r\n    currentDist = coordDistance[1+(nextPtIdx/2)] - nextDist;\r\n  } else if (nextPtIdx+2 == coordDistance.length) {\r\n    currentDist = totalDistance - nextDist;\r\n  } else {\r\n    currentDist = totalDistance;\r\n  }\r\n\r\n  if (!Bangle.isLCDOn()) return;\r\n  drawMap();\r\n}\r\n\r\nfunction arrow(r,c) {\r\n  r=r*Math.PI/180;\r\n  var p = Math.PI*3/4;\r\n  g.setColor(c);\r\n  g.fillPoly([\r\n    180+40*Math.sin(r), 180-40*Math.cos(r),\r\n    180+20*Math.sin(r+p), 180-20*Math.cos(r+p),\r\n    180-10*Math.sin(r), 180+10*Math.cos(r),\r\n    180+20*Math.sin(r+-p), 180-20*Math.cos(r-p),\r\n    ]);\r\n}\r\n\r\nfunction onCompass(m) {\r\n  if (!Bangle.isLCDOn()) return;\r\n\r\n  arrow(oldHeading,0);\r\n  var heading = m.heading + nextAngle;\r\n  arrow(heading,0xF800);\r\n  oldHeading = heading;\r\n}\r\n\r\n\r\n// draw the heading\r\nvar oldHeading = 0;\r\nBangle.on('GPS', onGPS);\r\nBangle.on('mag', onCompass);\r\nBangle.setGPSPower(1);\r\nBangle.setCompassPower(1);\r\ng.clear();\r\n");
require('Storage').write("*funrun5",require("heatshrink").decompress(atob("mEwwgurglEC6tDmYYUgkzAANAFygXKKYIADBwgXDkg8LBwwXMoQXEH4hHNC4s0O6BfECAKhDHYKnOghCB3cga6dEnYYBaScC2cznewC6W7OQU7BYyIFAAhFBAAYwGC5RFBC5QAJlY0FSIQAMkUjGgrTJRYoXFPQIXGLg8iAAJFDDgIXGgYXJGAWweQJHOC4jtBC6cidgQXUUQQXBogACDYR3HmQXHAAYzKU4IACC48kJBwFBgg7EMZYwDJAReDoh5PC4QARJAoARJAYXTJChtDoSgNAAaeEAAU0C5wqCC4q5LOYYvWgjOEaJ4AGoZGQPY6OPFw0yF34uFRlYXCFykAoQuVeIQWUAB4A=")));
require('Storage').write("+nceuwid",{"name":"nceuwid","type":"widget","src":"=nceuwid","files":"+nceuwid,=nceuwid"});
require('Storage').write("=nceuwid","(function(){\nvar img = E.toArrayBuffer(atob(\"SxgCAAAAAAAAAAAAAAAAAAAAAAAAALwDwH/gD/0B//Af+AAD4C8f/wL8Dwf/8H//C//C//AAD9C8f/wL9Dw//+H//i4AD0AH8D/C8fAAL/Dz///H//y8ALgAf/D/i8fAALrzz///H//2//PAAv/Dz28f/gLz7z///H//29VPQAv/Dx+8fqQLw/y///H//y4ALwAP/Dwv8fAALwfw//9H//i+qD8FC0DwP8fAALwPwP/4H/+C//A//AADwD8fAAAAAAC/QD+gAAAAL4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGqooBkD+AP0fgvgAAAAAAAAAAL/88C4NBw0NBjQcAAAAAAAAAALQA8C4AAyQDBjAJAAAAAAAAAALQA8C4AAzACBjAKAAAAAAAAAAL/88C4ABTACRjQbAAAAAAAAAAL/48C4AHDACRgvjAAAAAAAAAALQA8C4AcDACBgACAAAAAAAAAALQA+D0BwCQDBgANAAAAAAAAAAL/8P/wHAA0NBgAoAAAAAAAAAAGqoC+AP/0HgAQuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\"));\nvar xpos = WIDGETPOS.tl;\nWIDGETPOS.tl+=75;\n\n\nWIDGETS[\"nceu\"]={draw:()=>{\n  var x = xpos, y = 0;\n  g.setColor(0.17,0.2,0.5);\n  g.drawImage(img,x,y);\n  g.setColor(1,1,1);\n}};\n})()\n");
