(function () {
  const STORAGE_KEY = "fw_preferences";

  function defaultPrefs() {
    return {
      theme: "light",
      mapType: "roadmap",
      showTraffic: true,
    };
  }

  function loadPrefs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultPrefs();
      const parsed = JSON.parse(raw);
      return {
        theme: parsed.theme === "dark" ? "dark" : "light",
        mapType:
          parsed.mapType === "satellite" || parsed.mapType === "roadmap"
            ? parsed.mapType
            : "roadmap",
        showTraffic:
          typeof parsed.showTraffic === "boolean"
            ? parsed.showTraffic
            : true,
      };
    } catch (_) {
      return defaultPrefs();
    }
  }

  function savePrefs(prefs) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (_) {}
  }

  function applyTheme(theme) {
    const body = document.body;
    if (!body) return;
    if (theme === "dark") {
      body.classList.add("dark-mode");
    } else {
      body.classList.remove("dark-mode");
    }
  }

  const prefs = loadPrefs();

  document.addEventListener("DOMContentLoaded", function () {
    applyTheme(prefs.theme);

    const darkSwitch = document.getElementById("darkModeSwitch");
    if (darkSwitch) {
      darkSwitch.checked = prefs.theme === "dark";
      darkSwitch.addEventListener("change", function () {
        prefs.theme = darkSwitch.checked ? "dark" : "light";
        savePrefs(prefs);
        applyTheme(prefs.theme);
      });
      const formInterface = darkSwitch.closest("form");
      if (formInterface) {
        formInterface.addEventListener("submit", function (e) {
          e.preventDefault();
          prefs.theme = darkSwitch.checked ? "dark" : "light";
          savePrefs(prefs);
          applyTheme(prefs.theme);
          if (typeof Swal !== "undefined") {
            Swal.fire({
              icon: "success",
              title: "Preferências salvas",
            });
          }
        });
      }
    }

    const mapRoadmap = document.getElementById("mapRoadmap");
    const mapSatellite = document.getElementById("mapSatellite");

    if (mapRoadmap || mapSatellite ) {
      if (prefs.mapType === "satellite" && mapSatellite) {
        mapSatellite.checked = true;
      } else if (mapRoadmap) {
        mapRoadmap.checked = true;
      }

      [mapRoadmap, mapSatellite].forEach(function (radio) {
        if (!radio) return;
        radio.addEventListener("change", function () {
          if (!radio.checked) return;
          if (radio.id === "mapSatellite") {
            prefs.mapType = "satellite";
          } else {
            prefs.mapType = "roadmap";
          }
          savePrefs(prefs);
        });
      });
    }

    const showTrafficInput = document.getElementById("showTraffic");
    if (showTrafficInput) {
      showTrafficInput.checked = prefs.showTraffic;
      showTrafficInput.addEventListener("change", function () {
        prefs.showTraffic = !!showTrafficInput.checked;
        savePrefs(prefs);
      });
    }

    const restoreBtn = document.getElementById("btnRestoreMapPrefs");
    if (restoreBtn) {
      restoreBtn.addEventListener("click", function () {
        const defaults = defaultPrefs();
        prefs.theme = defaults.theme;
        prefs.mapType = defaults.mapType;
        prefs.showTraffic = defaults.showTraffic;
        savePrefs(prefs);
        applyTheme(prefs.theme);
        if (darkSwitch) {
          darkSwitch.checked = prefs.theme === "dark";
        }
        if (mapRoadmap) {
          mapRoadmap.checked = prefs.mapType === "roadmap";
        }
        if (mapSatellite) {
          mapSatellite.checked = prefs.mapType === "satellite";
        }
        if (showTrafficInput) {
          showTrafficInput.checked = prefs.showTraffic;
        }
        if (typeof Swal !== "undefined") {
          Swal.fire({
            icon: "success",
            title: "Padrões restaurados",
          });
        }
      });
    }
  });

  window.FWPreferences = {
    getPreferences: function () {
      return loadPrefs();
    },
    getMapPreferences: function () {
      const p = loadPrefs();
      return {
        mapType: p.mapType,
        showTraffic: p.showTraffic,
      };
    },
    getTheme: function () {
      const p = loadPrefs();
      return p.theme;
    },
    applyTheme: applyTheme,
  };
})();

