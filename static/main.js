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

    var $drop = $('#drop-zone');
    var $ph = $('#drop-placeholder');
    var $filled = $('#drop-filled');
    var $hidden = $('#quiz-answer-value');
    var currentId = null;

    shuffleChildren($('#drag-bank'));

    function restoreTile(id) {
      var $tile = $('.quiz-tile[data-tile-id="' + id + '"]');
      $tile.removeClass('is-placed').attr('draggable', true);
    }

    function clearDrop() {
      if (currentId) {
        restoreTile(currentId);
      }
      currentId = null;
      $hidden.val('');
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
      $filled.empty();
      $('<img>', { src: img, alt: '', class: 'drop-preview-img' }).appendTo($filled);
      $filled.removeClass('d-none');
      $ph.addClass('d-none');
      $tile.addClass('is-placed').attr('draggable', false);
    }

    $(document).on('dragstart', '.quiz-tile:not(.is-placed)', function (e) {
      var id = $(this).data('tile-id');
      if (e.originalEvent && e.originalEvent.dataTransfer) {
        e.originalEvent.dataTransfer.setData('text/plain', String(id));
        e.originalEvent.dataTransfer.effectAllowed = 'move';
      }
    });

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

    $('#btn-clear-drop').on('click', function () {
      clearDrop();
    });

    $('#btn-quiz-next').on('click', function () {
      var qid = $root.data('question-id');
      var total = parseInt($root.data('total'), 10);
      var val = ($hidden.val() || '').trim();
      if (!val) {
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
