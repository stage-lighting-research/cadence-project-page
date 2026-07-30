/* Cadence project page
 * Audio is the master clock. Comparison videos remain muted and never
 * start until the visitor plays the corresponding audio track.
 */

(function () {
  'use strict';

  var SYNC_INTERVAL_MS = 400;
  var MAX_DRIFT_SECONDS = 0.18;

  var reducedMotionQuery = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

  function all(selector, root) {
    return Array.prototype.slice.call(
      (root || document).querySelectorAll(selector)
    );
  }

  /* ------------------------------------------------------------------
   * Prompt loading
   * ------------------------------------------------------------------ */

  function loadPrompt(element) {
    var url = element.getAttribute('data-prompt-src');
    if (!url) return;

    element.setAttribute('aria-busy', 'true');

    if (typeof window.fetch !== 'function') {
      element.textContent = '';
      element.removeAttribute('aria-busy');
      return;
    }

    window.fetch(url, {
      cache: 'no-cache',
      credentials: 'same-origin'
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }
        return response.text();
      })
      .then(function (text) {
        var cleanText = text.trim();
        element.textContent =
          cleanText || '(empty lighting description)';
        element.classList.remove('is-error');
      })
      .catch(function (error) {
        var isLocalFile = window.location.protocol === 'file:';

        element.classList.add('is-error');
        element.textContent = isLocalFile
          ? '(Prompts cannot load over file://. Run: python3 -m http.server 8000)'
          : '(Lighting description unavailable)';

        console.warn('Prompt fetch failed:', url, error);
      })
      .finally(function () {
        element.removeAttribute('aria-busy');
      });
  }

  all('.prompt[data-prompt-src]').forEach(loadPrompt);

  /* ------------------------------------------------------------------
   * Media helpers
   * ------------------------------------------------------------------ */

  function playSafely(media) {
    if (!media) return Promise.resolve(false);

    try {
      var result = media.play();

      if (result && typeof result.then === 'function') {
        return result
          .then(function () {
            return true;
          })
          .catch(function () {
            return false;
          });
      }

      return Promise.resolve(true);
    } catch (error) {
      return Promise.resolve(false);
    }
  }

  function syncVideoToAudio(video, audio, force) {
    if (!video || !audio) return;

    if (
      video.readyState === 0 ||
      !Number.isFinite(video.duration) ||
      video.duration <= 0
    ) {
      if (video.getAttribute('data-sync-waiting') !== 'true') {
        video.setAttribute('data-sync-waiting', 'true');

        video.addEventListener(
          'loadedmetadata',
          function () {
            video.removeAttribute('data-sync-waiting');
            syncVideoToAudio(video, audio, true);
          },
          { once: true }
        );
      }

      return;
    }

    if (!Number.isFinite(audio.currentTime)) return;

    var duration = video.duration;
    var targetTime = audio.currentTime % duration;
    var rawDrift = Math.abs(video.currentTime - targetTime);

    /*
     * Account for the looping boundary. For example, 9.95 s and
     * 0.05 s are only 0.10 s apart in a 10-second video.
     */
    var circularDrift = Math.min(
      rawDrift,
      Math.max(0, duration - rawDrift)
    );

    video.playbackRate = audio.playbackRate || 1;

    if (force || circularDrift > MAX_DRIFT_SECONDS) {
      try {
        video.currentTime = targetTime;
      } catch (error) {
        /*
         * Some browsers temporarily reject seeks while the video
         * metadata or media buffer is loading.
         */
      }
    }
  }

  /* ------------------------------------------------------------------
   * Synchronized comparison player
   * ------------------------------------------------------------------ */

  function ExamplePlayer(example, onActivate) {
    this.example = example;
    this.grid = example.querySelector('.video-grid');
    this.audio = example.querySelector('.ref-audio');
    this.videos = this.grid ? all('video', this.grid) : [];
    this.onActivate = onActivate;
    this.syncTimer = null;
    this.ready = Boolean(
      this.grid &&
      this.audio &&
      this.videos.length
    );

    if (this.ready) {
      this.initialize();
    }
  }

  ExamplePlayer.prototype.initialize = function () {
    var self = this;

    this.videos.forEach(function (video) {
      var figure = video.closest('figure');
      var caption = figure
        ? figure.querySelector('figcaption')
        : null;

      var label = caption
        ? caption.textContent.trim()
        : 'comparison video';

      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.playsInline = true;
      video.pause();

      /*
       * The videos also act as synchronized play/pause buttons.
       */
      video.tabIndex = 0;
      video.setAttribute('role', 'button');
      video.setAttribute(
        'aria-label',
        'Play or pause synchronized comparison: ' + label
      );
      video.setAttribute('aria-pressed', 'false');
      video.title = 'Play or pause synchronized comparison';

      video.addEventListener('click', function () {
        self.toggleAudio();
      });

      video.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          self.toggleAudio();
        }
      });

      video.addEventListener('error', function () {
        if (figure) {
          figure.classList.add('has-media-error');
        }

        console.warn(
          'Video failed to load:',
          video.currentSrc || video.src
        );
      });
    });

    this.audio.addEventListener('play', function () {
      self.onActivate(self);
      self.startVisuals();
    });

    this.audio.addEventListener('playing', function () {
      self.startVisuals();
    });

    this.audio.addEventListener('pause', function () {
      self.stopVisuals();
    });

    this.audio.addEventListener('ended', function () {
      self.stopVisuals();
    });

    this.audio.addEventListener('waiting', function () {
      self.suspendVisuals(true);
    });

    this.audio.addEventListener('stalled', function () {
      self.suspendVisuals(true);
    });

    this.audio.addEventListener('seeking', function () {
      self.sync(true);
    });

    this.audio.addEventListener('seeked', function () {
      self.sync(true);
    });

    this.audio.addEventListener('ratechange', function () {
      self.sync(true);
    });

    this.audio.addEventListener('timeupdate', function () {
      self.sync(false);
    });
  };

  ExamplePlayer.prototype.toggleAudio = function () {
    if (this.audio.paused) {
      playSafely(this.audio);
    } else {
      this.audio.pause();
    }
  };

  ExamplePlayer.prototype.startVisuals = function () {
    var self = this;

    if (this.audio.paused) return;

    this.grid.classList.add('is-playing');
    this.grid.classList.remove('is-buffering');

    this.sync(true);

    this.videos.forEach(function (video) {
      video.setAttribute('aria-pressed', 'true');
      playSafely(video);
    });

    if (!this.syncTimer) {
      this.syncTimer = window.setInterval(function () {
        self.sync(false);
      }, SYNC_INTERVAL_MS);
    }
  };

  ExamplePlayer.prototype.stopVisuals = function () {
    this.grid.classList.remove('is-playing');
    this.grid.classList.remove('is-buffering');

    this.videos.forEach(function (video) {
      video.pause();
      video.setAttribute('aria-pressed', 'false');
    });

    this.stopSyncTimer();
  };

  ExamplePlayer.prototype.suspendVisuals = function (showBuffering) {
    if (showBuffering) {
      this.grid.classList.add('is-buffering');
    }

    this.videos.forEach(function (video) {
      video.pause();
    });

    this.stopSyncTimer();
  };

  ExamplePlayer.prototype.stopSyncTimer = function () {
    if (this.syncTimer) {
      window.clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  };

  ExamplePlayer.prototype.sync = function (force) {
    var self = this;

    this.videos.forEach(function (video) {
      syncVideoToAudio(video, self.audio, force);
    });
  };

  ExamplePlayer.prototype.pauseAudio = function () {
    if (!this.audio.paused) {
      this.audio.pause();
    }
  };

  /* ------------------------------------------------------------------
   * Initialize all synchronized examples
   * ------------------------------------------------------------------ */

  var players = [];

  function activatePlayer(activePlayer) {
    players.forEach(function (player) {
      if (player !== activePlayer) {
        player.pauseAudio();
      }
    });
  }

  players = all('.example')
    .map(function (example) {
      return new ExamplePlayer(
        example,
        activatePlayer
      );
    })
    .filter(function (player) {
      return player.ready;
    });

  /*
   * Pause video decoding while the page is hidden. The audio may
   * continue playing, and the videos resynchronize when the tab returns.
   */
  document.addEventListener('visibilitychange', function () {
    players.forEach(function (player) {
      if (document.hidden) {
        player.suspendVisuals(false);
      } else if (!player.audio.paused) {
        player.startVisuals();
      }
    });
  });

  /* ------------------------------------------------------------------
   * Copy buttons
   * ------------------------------------------------------------------ */

  function fallbackCopy(text) {
    var textarea = document.createElement('textarea');
    var previousFocus = document.activeElement;
    var successful = false;

    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.setAttribute('aria-hidden', 'true');

    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    textarea.style.opacity = '0';

    document.body.appendChild(textarea);
    textarea.select();

    try {
      successful = document.execCommand('copy');
    } catch (error) {
      successful = false;
    }

    document.body.removeChild(textarea);

    if (
      previousFocus &&
      typeof previousFocus.focus === 'function'
    ) {
      previousFocus.focus();
    }

    return successful;
  }

  function copyText(text) {
    if (
      window.isSecureContext &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      return navigator.clipboard
        .writeText(text)
        .then(function () {
          return true;
        })
        .catch(function () {
          return fallbackCopy(text);
        });
    }

    return Promise.resolve(
      fallbackCopy(text)
    );
  }

  all('.btn-copy').forEach(function (button) {
    button.addEventListener('click', function () {
      var selector = button.getAttribute('data-copy-target');
      var target = null;

      if (!selector) return;

      try {
        target = document.querySelector(selector);
      } catch (error) {
        console.warn(
          'Invalid copy selector:',
          selector
        );
        return;
      }

      if (!target) return;

      var text = (
        target.textContent ||
        target.innerText ||
        ''
      ).trim();

      if (!text) return;

      copyText(text).then(function (successful) {
        var idle = button.querySelector('.copy-idle');
        var done = button.querySelector('.copy-done');

        if (idle) {
          idle.hidden = true;
        }

        if (done) {
          done.hidden = false;
          done.textContent = successful
            ? 'Copied'
            : 'Copy failed';
        }

        window.setTimeout(function () {
          if (idle) {
            idle.hidden = false;
          }

          if (done) {
            done.hidden = true;
          }
        }, 1600);
      });
    });
  });

  /* ------------------------------------------------------------------
   * Disabled placeholder links
   * ------------------------------------------------------------------ */

  all('[data-role="paper"][href="#"]').forEach(function (link) {
    link.setAttribute('aria-disabled', 'true');
    link.setAttribute(
      'title',
      'Paper link coming soon'
    );

    link.addEventListener('click', function (event) {
      event.preventDefault();
    });
  });

  /* ------------------------------------------------------------------
   * Accessible in-page scrolling
   * ------------------------------------------------------------------ */

  document.addEventListener('click', function (event) {
    var anchor = event.target.closest('a[href^="#"]');

    if (
      !anchor ||
      anchor.getAttribute('aria-disabled') === 'true'
    ) {
      return;
    }

    var href = anchor.getAttribute('href');

    if (!href || href === '#') {
      return;
    }

    var id;

    try {
      id = decodeURIComponent(
        href.slice(1)
      );
    } catch (error) {
      return;
    }

    var target = document.getElementById(id);

    if (!target) {
      return;
    }

    event.preventDefault();

    target.scrollIntoView({
      behavior: reducedMotionQuery.matches
        ? 'auto'
        : 'smooth',
      block: 'start'
    });

    if (
      window.history &&
      typeof window.history.pushState === 'function'
    ) {
      window.history.pushState(
        null,
        '',
        href
      );
    } else {
      window.location.hash = href;
    }
  });
})();