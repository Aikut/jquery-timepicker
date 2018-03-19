const _ONE_DAY = 86400;
const _DEFAULTS = {
  appendTo: "body",
  className: null,
  closeOnWindowScroll: false,
  disableTextInput: false,
  disableTimeRanges: [],
  disableTouchKeyboard: false,
  durationTime: null,
  forceRoundTime: false,
  maxTime: null,
  minTime: null,
  noneOption: false,
  orientation: "l",
  roundingFunction: function(seconds, settings) {
    if (seconds === null) {
      return null;
    } else if (typeof settings.step !== "number") {
      // TODO: nearest fit irregular steps
      return seconds;
    } else {
      var offset = seconds % (settings.step * 60); // step is in minutes

      var start = settings.minTime || 0;

      // adjust offset by start mod step so that the offset is aligned not to 00:00 but to the start
      offset -= start % (settings.step * 60);

      if (offset >= settings.step * 30) {
        // if offset is larger than a half step, round up
        seconds += settings.step * 60 - offset;
      } else {
        // round down
        seconds -= offset;
      }

      return _moduloSeconds(seconds, settings);
    }
  },
  scrollDefault: null,
  selectOnBlur: false,
  show2400: false,
  showDuration: false,
  showOn: ["click", "focus"],
  showOnFocus: true,
  step: 30,
  stopScrollPropagation: false,
  timeFormat: "g:ia",
  typeaheadHighlight: true,
  useSelect: false,
  wrapHours: true
};

let _lang = {
  am: 'am',
  pm: 'pm',
  AM: 'AM',
  PM: 'PM',
  decimal: '.',
  mins: 'mins',
  hr: 'hr',
  hrs: 'hrs'
};

class Timepicker {
  constructor(targetEl, options = {}) {
    const attrOptions = Timepicker.extractAttrOptions(targetEl, Object.keys(_DEFAULTS));
    this.settings = Timepicker.parseSettings({
      ..._DEFAULTS,
      ...options,
      ...attrOptions,
    });

    if ('lang' in options) {
      _lang = { ..._lang, ...options.lang };
    }
  }

  static extractAttrOptions(element, keys) {
    const output = {};
    for (const key of keys) {
      // console.log(key, element)
      if (key in element.dataset) {
        output[key] = element.dataset[key];
      }
    }
    return output;
  }

  static time2int(timeString, settings) {
    if (timeString === "" || timeString === null) return null;
    if (typeof timeString == "object") {
      return (
        timeString.getHours() * 3600 +
        timeString.getMinutes() * 60 +
        timeString.getSeconds()
      );
    }
    if (typeof timeString != "string") {
      return timeString;
    }

    timeString = timeString.toLowerCase().replace(/[\s\.]/g, "");

    // if the last character is an "a" or "p", add the "m"
    if (timeString.slice(-1) == "a" || timeString.slice(-1) == "p") {
      timeString += "m";
    }

    var ampmRegex =
      "(" +
      _lang.am.replace(".", "") +
      "|" +
      _lang.pm.replace(".", "") +
      "|" +
      _lang.AM.replace(".", "") +
      "|" +
      _lang.PM.replace(".", "") +
      ")?";

    // try to parse time input
    var pattern = new RegExp(
      "^" +
        ampmRegex +
        "([0-9]?[0-9])\\W?([0-5][0-9])?\\W?([0-5][0-9])?" +
        ampmRegex +
        "$"
    );

    var time = timeString.match(pattern);
    if (!time) {
      return null;
    }

    var hour = parseInt(time[2] * 1, 10);
    var ampm = time[1] || time[5];
    var hours = hour;
    var minutes = time[3] * 1 || 0;
    var seconds = time[4] * 1 || 0;

    if (hour <= 12 && ampm) {
      var isPm = ampm == _lang.pm || ampm == _lang.PM;

      if (hour == 12) {
        hours = isPm ? 12 : 0;
      } else {
        hours = hour + (isPm ? 12 : 0);
      }
    } else if (settings) {
      var t = hour * 3600 + minutes * 60 + seconds;
      if (t >= _ONE_DAY + (settings.show2400 ? 1 : 0)) {
        if (settings.wrapHours === false) {
          return null;
        }

        hours = hour % 24;
      }
    }

    var timeInt = hours * 3600 + minutes * 60 + seconds;

    // if no am/pm provided, intelligently guess based on the scrollDefault
    if (
      hour < 12 &&
      !ampm &&
      settings &&
      settings._twelveHourTime &&
      settings.scrollDefault
    ) {
      var delta = timeInt - settings.scrollDefault();
      if (delta < 0 && delta >= _ONE_DAY / -2) {
        timeInt = (timeInt + _ONE_DAY / 2) % _ONE_DAY;
      }
    }

    return timeInt;
  }

  static parseSettings(settings) {
    if (settings.minTime) {
      settings.minTime = Timepicker.time2int(settings.minTime);
    }

    if (settings.maxTime) {
      settings.maxTime = Timepicker.time2int(settings.maxTime);
    }

    if (settings.durationTime && typeof settings.durationTime !== "function") {
      settings.durationTime = Timepicker.time2int(settings.durationTime);
    }

    if (settings.scrollDefault == "now") {
      settings.scrollDefault = function() {
        return settings.roundingFunction(Timepicker.time2int(new Date()), settings);
      };
    } else if (
      settings.scrollDefault &&
      typeof settings.scrollDefault != "function"
    ) {
      var val = settings.scrollDefault;
      settings.scrollDefault = function() {
        return settings.roundingFunction(Timepicker.time2int(val), settings);
      };
    } else if (settings.minTime) {
      settings.scrollDefault = function() {
        return settings.roundingFunction(settings.minTime, settings);
      };
    }

    if (
      typeof settings.timeFormat === "string"
        && settings.timeFormat.match(/[gh]/)
    ) {
      settings._twelveHourTime = true;
    }

    if (
      settings.showOnFocus === false &&
      settings.showOn.indexOf("focus") != -1
    ) {
      settings.showOn.splice(settings.showOn.indexOf("focus"), 1);
    }

    if (settings.disableTimeRanges.length > 0) {
      // convert string times to integers
      for (var i in settings.disableTimeRanges) {
        settings.disableTimeRanges[i] = [
          Timepicker.time2int(settings.disableTimeRanges[i][0]),
          Timepicker.time2int(settings.disableTimeRanges[i][1])
        ];
      }

      // sort by starting time
      settings.disableTimeRanges = settings.disableTimeRanges.sort(function(
        a,
        b
      ) {
        return a[0] - b[0];
      });

      // merge any overlapping ranges
      for (var i = settings.disableTimeRanges.length - 1; i > 0; i--) {
        if (
          settings.disableTimeRanges[i][0] <=
          settings.disableTimeRanges[i - 1][1]
        ) {
          settings.disableTimeRanges[i - 1] = [
            Math.min(
              settings.disableTimeRanges[i][0],
              settings.disableTimeRanges[i - 1][0]
            ),
            Math.max(
              settings.disableTimeRanges[i][1],
              settings.disableTimeRanges[i - 1][1]
            )
          ];
          settings.disableTimeRanges.splice(i, 1);
        }
      }
    }

    return settings;
  }
}

export default Timepicker;
