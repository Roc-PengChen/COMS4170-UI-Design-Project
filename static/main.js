(function ($) {
  'use strict';

  function postJson(url, payload) {
    return $.ajax({
      url: url,
      method: 'POST',
      contentType: 'application/json; charset=UTF-8',
      data: JSON.stringify(payload || {})
    });
  }

  function logPageEnter() {
    var route = window.__PAGE_LOG__ && window.__PAGE_LOG__.route ? window.__PAGE_LOG__.route : window.location.pathname;
    var kind = window.__PAGE_LOG__ && window.__PAGE_LOG__.kind ? window.__PAGE_LOG__.kind : 'generic';
    postJson('/api/log', {
      type: 'page_enter',
      route: route,
      payload: { kind: kind, path: window.location.pathname, search: window.location.search }
    });
  }

  function shuffleChildren($container) {
    var nodes = $container.children().get();
    var i;
    var j;
    var tmp;
    for (i = nodes.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      tmp = nodes[i];
      nodes[i] = nodes[j];
      nodes[j] = tmp;
    }
    $.each(nodes, function (_, el) {
      $container.append(el);
    });
  }

  function syncAudioTimeToVideo(video, audio) {
    var t = video.currentTime;
    if (audio.duration && isFinite(audio.duration)) {
      t = Math.min(t, Math.max(0, audio.duration - 0.05));
    }
    try {
      audio.currentTime = t;
    } catch (e) {
      /* ignore seek errors before metadata */
    }
  }

  /** Home: when user plays the hero video, start the Listen audio in sync (same page only). */
  function initHomeVideoAudioSync() {
    var video = document.getElementById('home-hero-video');
    var audio = document.getElementById('home-sample-audio');
    if (!video || !audio) {
      return;
    }

    video.addEventListener('play', function () {
      syncAudioTimeToVideo(video, audio);
      audio.play().catch(function () {
        /* autoplay policy: ignore if blocked */
      });
    });

    video.addEventListener('pause', function () {
      audio.pause();
    });

    video.addEventListener('seeked', function () {
      syncAudioTimeToVideo(video, audio);
    });

    video.addEventListener('ended', function () {
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch (e) {
        /* ignore */
      }
    });
  }

  function initQuizDrag() {
    var $root = $('#quiz-drag-app');
    if (!$root.length) {
      return;
    }

    var $hidden = $('#quiz-answer-value');
    var mode = String($root.data('quiz-mode') || '');
    var currentId = null;
    var seqIds = [null, null, null];

    shuffleChildren($('#drag-bank'));

    function restoreTile(id) {
      var $tile = $('.quiz-tile[data-tile-id="' + id + '"]');
      $tile.removeClass('is-placed').attr('draggable', true);
    }

    function markTilePlaced(id) {
      var $tile = $('.quiz-tile[data-tile-id="' + id + '"]');
      $tile.addClass('is-placed').attr('draggable', false);
    }

    function clearDrop() {
      $hidden.val('');
      if (mode === 'notation_seq_to_keys') {
        seqIds.forEach(function (id) {
          if (id) {
            restoreTile(id);
          }
        });
        seqIds = [null, null, null];
        $('.drop-slot').each(function () {
          $(this).find('.drop-zone__filled').addClass('d-none').empty();
          $(this).find('.drop-zone__placeholder').removeClass('d-none');
        });
        return;
      }
      if (currentId) {
        restoreTile(currentId);
      }
      currentId = null;
      var $filled = $('#drop-filled');
      var $ph = $('#drop-placeholder');
      $filled.addClass('d-none').empty();
      $ph.removeClass('d-none');
    }

    function placeTile(id) {
      var $tile = $('.quiz-tile[data-tile-id="' + id + '"]');
      if (!$tile.length || $tile.hasClass('is-placed')) {
        return;
      }
      if (currentId && currentId !== id) {
        restoreTile(currentId);
      }
      currentId = id;
      $hidden.val(id);
      var img = $tile.find('img').attr('src');
      var $filled = $('#drop-filled');
      var $ph = $('#drop-placeholder');
      $filled.empty();
      $('<img>', { src: img, alt: '', class: 'drop-preview-img' }).appendTo($filled);
      $filled.removeClass('d-none');
      $ph.addClass('d-none');
      markTilePlaced(id);
    }

    function placeTileToSlot(id, slotIdx) {
      var idx = parseInt(slotIdx, 10);
      if (!isFinite(idx) || idx < 0 || idx > 2) {
        return;
      }
      var $tile = $('.quiz-tile[data-tile-id="' + id + '"]');
      if (!$tile.length || $tile.hasClass('is-placed')) {
        return;
      }

      var prev = seqIds[idx];
      if (prev && prev !== id) {
        restoreTile(prev);
      }
      seqIds[idx] = id;
      $hidden.val(seqIds.map(function (x) { return x || ''; }).join(','));

      var $slot = $('.drop-slot[data-slot="' + idx + '"]');
      var $filled = $slot.find('.drop-zone__filled');
      var $ph = $slot.find('.drop-zone__placeholder');
      var img = $tile.find('img').attr('src');
      $filled.empty();
      $('<img>', { src: img, alt: '', class: 'drop-preview-img' }).appendTo($filled);
      $filled.removeClass('d-none');
      $ph.addClass('d-none');
      markTilePlaced(id);
    }

    $(document).on('dragstart', '.quiz-tile:not(.is-placed)', function (e) {
      var id = $(this).data('tile-id');
      if (e.originalEvent && e.originalEvent.dataTransfer) {
        e.originalEvent.dataTransfer.setData('text/plain', String(id));
        e.originalEvent.dataTransfer.effectAllowed = 'move';
      }
    });

    if (mode === 'notation_seq_to_keys') {
      $(document).on('dragenter', '.drop-slot', function (e) {
        e.preventDefault();
        $(this).addClass('drag-over');
      });
      $(document).on('dragleave', '.drop-slot', function () {
        $(this).removeClass('drag-over');
      });
      $(document).on('dragover', '.drop-slot', function (e) {
        e.preventDefault();
        if (e.originalEvent && e.originalEvent.dataTransfer) {
          e.originalEvent.dataTransfer.dropEffect = 'move';
        }
      });
      $(document).on('drop', '.drop-slot', function (e) {
        e.preventDefault();
        $(this).removeClass('drag-over');
        var dt = e.originalEvent && e.originalEvent.dataTransfer;
        if (!dt) {
          return;
        }
        var id = dt.getData('text/plain');
        if (!id) {
          return;
        }
        placeTileToSlot(id, $(this).data('slot'));
      });
    } else {
      var $drop = $('#drop-zone');
      $drop.on('dragenter', function (e) {
        e.preventDefault();
        $drop.addClass('drag-over');
      });
      $drop.on('dragleave', function () {
        $drop.removeClass('drag-over');
      });
      $drop.on('dragover', function (e) {
        e.preventDefault();
        if (e.originalEvent && e.originalEvent.dataTransfer) {
          e.originalEvent.dataTransfer.dropEffect = 'move';
        }
      });
      $drop.on('drop', function (e) {
        e.preventDefault();
        $drop.removeClass('drag-over');
        var dt = e.originalEvent && e.originalEvent.dataTransfer;
        if (!dt) {
          return;
        }
        var id = dt.getData('text/plain');
        if (!id) {
          return;
        }
        placeTile(id);
      });
    }

    $('#btn-clear-drop').on('click', function () {
      clearDrop();
    });

    $('#btn-quiz-next').on('click', function () {
      var qid = $root.data('question-id');
      var total = parseInt($root.data('total'), 10);
      var val = ($hidden.val() || '').trim();
      if (mode === 'notation_seq_to_keys') {
        var parts = val.split(',').filter(function (p) { return p.trim().length > 0; });
        if (parts.length < 3 || parts.some(function (p) { return !p; })) {
          window.alert('Fill all three boxes in order before continuing.');
          return;
        }
      } else if (!val) {
        window.alert('Drag one tile into the box before continuing.');
        return;
      }
      postJson('/api/quiz/answer', {
        question_id: qid,
        answer: val
      }).always(function () {
        var n = parseInt(qid, 10);
        if (n < total) {
          window.location.href = '/quiz/' + (n + 1);
        } else {
          window.location.href = '/quiz/result';
        }
      });
    });
  }

  $(document).ready(function () {
    logPageEnter();

    $('#btn-start-learning').on('click', function () {
      postJson('/api/session/start_learning', {}).always(function () {
        window.location.href = '/learn/1';
      });
    });

    initQuizDrag();
    initHomeVideoAudioSync();

    $(document).on('click', '#btn-quiz-tips', function () {
      var $panel = $('#quiz-tips-panel');
      if (!$panel.length) {
        return;
      }
      $panel.toggleClass('d-none');
      var open = !$panel.hasClass('d-none');
      $(this).attr('aria-expanded', open);
    });

    $('#btn-retake-quiz').on('click', function () {
      postJson('/api/quiz/reset', {}).always(function () {
        window.location.href = '/quiz/1';
      });
    });

    $('#link-go-quiz-fresh').on('click', function (e) {
      e.preventDefault();
      postJson('/api/quiz/reset', {}).always(function () {
        window.location.href = '/quiz/1';
      });
    });
  });
})(jQuery);
