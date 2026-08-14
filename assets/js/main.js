/* 모모필라테스 — 페이지 동작
   수정이 필요한 값은 아래 CONFIG 한 곳에 모여 있습니다. */

(function () {
  "use strict";

  var CONFIG = {
    // 카카오톡 채널 주소. 비워 두면 문의 폼으로 안내합니다.
    kakaoUrl: "",
    // 폼을 받을 주소(구글폼·Formspree 등). 비워 두면 전화/카카오 안내를 띄웁니다.
    formEndpoint: "",
    // 안내 문구에 쓰이는 대표 번호. index.html의 tel: 링크도 함께 바꿔 주세요.
    phone: "000-0000-0000"
  };

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------ 내비게이션 */

  var nav = document.getElementById("nav");
  var toggle = document.getElementById("navToggle");
  var panel = document.getElementById("navPanel");

  if (nav) {
    var onScroll = function () {
      nav.classList.toggle("is-stuck", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  if (toggle && panel) {
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      panel.classList.toggle("is-open", !open);
    });

    panel.addEventListener("click", function (event) {
      if (event.target.closest("a")) {
        toggle.setAttribute("aria-expanded", "false");
        panel.classList.remove("is-open");
      }
    });
  }

  /* ------------------------------------------------------------- 등장 효과 */

  var revealables = document.querySelectorAll(".reveal");

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealables.forEach(function (el) {
      el.classList.add("is-in");
    });
  } else {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
    );
    revealables.forEach(function (el) {
      revealObserver.observe(el);
    });
  }

  /* ------------------------------------------------------------ 척추 진단도

     구부정한 자세(A)에서 중립 정렬(B)로 이동하는 모습을 두 곡선 사이를
     보간해 그립니다. 통증 표시는 자세가 펴질수록 함께 옅어집니다. */

  var SVG_NS = "http://www.w3.org/2000/svg";

  // 요추가 펴지고(전만 소실) 등이 굽으며 머리가 앞으로 나간 자세
  var POSTURE_SLOUCHED =
    "M118 488 C124 452 120 414 112 372 C96 322 62 290 74 236 C84 190 130 178 158 150 C170 138 176 128 180 118";
  // 요추 전만·흉추 후만·경추 전만이 제자리를 찾은 중립 정렬
  var POSTURE_NEUTRAL =
    "M118 488 C146 452 150 410 130 368 C108 320 88 292 92 240 C96 196 124 176 122 132 C121 120 119 114 118 108";

  var VERTEBRAE = 24; // 요추 5 + 흉추 12 + 경추 7, 아래에서 위로
  var GAP = 3; // 추간판 간격

  // 진단 라벨은 자세가 교정된 뒤에 나타납니다.
  var REGIONS = [
    { name: "경추", index: 20, y: 150 },
    { name: "흉추", index: 11, y: 285 },
    { name: "요추", index: 2, y: 430 }
  ];

  var HOTSPOTS = [
    { index: 21, radius: 21 }, // 목
    { index: 2, radius: 24 } // 허리
  ];

  function buildSpine() {
    var svg = document.getElementById("spineSvg");
    var group = document.getElementById("spineParts");
    if (!svg || !group || typeof SVGPathElement === "undefined") return null;

    var pathA = document.createElementNS(SVG_NS, "path");
    var pathB = document.createElementNS(SVG_NS, "path");
    pathA.setAttribute("d", POSTURE_SLOUCHED);
    pathB.setAttribute("d", POSTURE_NEUTRAL);
    pathA.setAttribute("fill", "none");
    pathB.setAttribute("fill", "none");
    group.appendChild(pathA);
    group.appendChild(pathB);

    if (!pathA.getTotalLength || !pathA.getTotalLength()) return null;

    // 척추뼈 크기: 아래(요추)가 크고 위(경추)로 갈수록 작아집니다.
    var bones = [];
    var stackHeight = 0;
    var i;
    for (i = 0; i < VERTEBRAE; i++) {
      var u = i / (VERTEBRAE - 1);
      var h = 16 - 8 * Math.pow(u, 0.9);
      bones.push({ width: 32 - 20 * Math.pow(u, 0.85), height: h, center: 0 });
      stackHeight += h;
    }
    stackHeight += GAP * (VERTEBRAE - 1);

    var cursor = 0;
    for (i = 0; i < VERTEBRAE; i++) {
      cursor += bones[i].height / 2;
      bones[i].center = cursor / stackHeight;
      cursor += bones[i].height / 2 + GAP;
    }

    // 그리기 순서: 통증 표시 → 척추뼈 → 라벨
    var flareLayer = document.createElementNS(SVG_NS, "g");
    var boneLayer = document.createElementNS(SVG_NS, "g");
    var labelLayer = document.createElementNS(SVG_NS, "g");
    group.appendChild(flareLayer);
    group.appendChild(boneLayer);
    group.appendChild(labelLayer);

    var flares = HOTSPOTS.map(function (spot) {
      var circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("class", "spine__flare");
      circle.setAttribute("r", String(spot.radius));
      flareLayer.appendChild(circle);
      return circle;
    });

    var sacrum = document.createElementNS(SVG_NS, "path");
    sacrum.setAttribute("class", "spine__sacrum");
    sacrum.setAttribute("d", "M-15 -9 L15 -9 L9 13 L-9 13 Z");
    boneLayer.appendChild(sacrum);

    var pieces = bones.map(function (bone) {
      var node = document.createElementNS(SVG_NS, "g");
      var body = document.createElementNS(SVG_NS, "rect");
      body.setAttribute("class", "spine__bone");
      body.setAttribute("x", String(-bone.width / 2));
      body.setAttribute("y", String(-bone.height / 2));
      body.setAttribute("width", String(bone.width));
      body.setAttribute("height", String(bone.height));
      body.setAttribute("rx", "2.5");
      node.appendChild(body);

      // 극돌기 — 등 쪽(뒤)으로 뻗는 돌기
      var spur = document.createElementNS(SVG_NS, "rect");
      spur.setAttribute("class", "spine__bone");
      spur.setAttribute("x", String(-bone.width / 2 - bone.width * 0.3));
      spur.setAttribute("y", String(-bone.height * 0.16));
      spur.setAttribute("width", String(bone.width * 0.32));
      spur.setAttribute("height", String(bone.height * 0.32));
      spur.setAttribute("rx", "1.5");
      node.appendChild(spur);

      boneLayer.appendChild(node);
      return node;
    });

    // 옆에서 본 머리 — 하나의 윤곽선으로 그려 겹치는 선이 생기지 않게 합니다.
    // 얼굴(코·턱)은 앞(+x)을 향합니다.
    var skull = document.createElementNS(SVG_NS, "g");
    var head = document.createElementNS(SVG_NS, "path");
    head.setAttribute("class", "spine__skull");
    head.setAttribute(
      "d",
      "M-2 -23 C12 -23 23 -15 25 -4 C26 2 30 6 30 10 C30 13 26 14 24 14 " +
        "C24 19 22 23 17 24 C8 26 -4 22 -11 15 C-18 8 -20 -4 -15 -13 C-11 -20 -8 -23 -2 -23 Z"
    );
    skull.appendChild(head);
    boneLayer.appendChild(skull);

    var labels = REGIONS.map(function (region) {
      var node = document.createElementNS(SVG_NS, "g");
      var leader = document.createElementNS(SVG_NS, "line");
      leader.setAttribute("class", "spine__leader");
      var text = document.createElementNS(SVG_NS, "text");
      text.setAttribute("class", "spine__label");
      text.setAttribute("x", "204");
      text.setAttribute("y", String(region.y + 4));
      text.textContent = region.name;
      node.appendChild(leader);
      node.appendChild(text);
      labelLayer.appendChild(node);
      return { node: node, leader: leader, region: region };
    });

    var lengthA = pathA.getTotalLength();
    var lengthB = pathB.getTotalLength();

    function sample(path, total, fraction) {
      return path.getPointAtLength(Math.max(0, Math.min(total, total * fraction)));
    }

    function blendAt(fraction, t) {
      var a = sample(pathA, lengthA, fraction);
      var b = sample(pathB, lengthB, fraction);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }

    function render(t) {
      var positions = bones.map(function (bone) {
        return blendAt(bone.center, t);
      });

      // 접선 방향으로 각 뼈를 회전시킵니다.
      pieces.forEach(function (piece, index) {
        var here = positions[index];
        var prev = index > 0 ? positions[index - 1] : blendAt(0, t);
        var next =
          index < positions.length - 1 ? positions[index + 1] : blendAt(1, t);
        var angle =
          (Math.atan2(next.y - prev.y, next.x - prev.x) * 180) / Math.PI + 90;
        piece.setAttribute(
          "transform",
          "translate(" + here.x + " " + here.y + ") rotate(" + angle + ")"
        );
      });

      var base = blendAt(0, t);
      var baseNext = blendAt(0.04, t);
      var baseAngle =
        (Math.atan2(baseNext.y - base.y, baseNext.x - base.x) * 180) / Math.PI + 90;
      sacrum.setAttribute(
        "transform",
        "translate(" + base.x + " " + (base.y + 8) + ") rotate(" + baseAngle + ")"
      );

      var top = blendAt(1, t);
      var below = blendAt(0.94, t);
      var dx = top.x - below.x;
      var dy = top.y - below.y;
      var len = Math.hypot(dx, dy) || 1;
      var headAngle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      skull.setAttribute(
        "transform",
        "translate(" +
          (top.x + (dx / len) * 26) +
          " " +
          (top.y + (dy / len) * 26) +
          ") rotate(" +
          headAngle +
          ")"
      );

      // 통증 표시는 자세가 펴질수록 옅어집니다.
      var pain = Math.max(0, 1 - t);
      flares.forEach(function (circle, index) {
        var at = positions[HOTSPOTS[index].index];
        circle.setAttribute("cx", String(at.x));
        circle.setAttribute("cy", String(at.y));
        circle.setAttribute("opacity", String(0.06 + 0.32 * pain));
        circle.setAttribute(
          "r",
          String(HOTSPOTS[index].radius * (0.72 + 0.28 * pain))
        );
      });

      // 라벨은 교정이 끝나갈 무렵 나타납니다.
      var labelFade = Math.max(0, Math.min(1, (t - 0.6) / 0.35));
      labels.forEach(function (item) {
        var at = positions[item.region.index];
        item.leader.setAttribute("x1", String(at.x + 22));
        item.leader.setAttribute("y1", String(at.y));
        item.leader.setAttribute("x2", "198");
        item.leader.setAttribute("y2", String(item.region.y));
        item.node.setAttribute("opacity", String(labelFade));
      });
    }

    return { render: render };
  }

  var spine = buildSpine();

  if (spine) {
    var stateLabel = document.getElementById("spineState");
    var replay = document.getElementById("spineReplay");
    var figure = document.getElementById("spineFigure");
    var animating = false;

    function setState(t) {
      if (!stateLabel) return;
      stateLabel.textContent = t < 0.5 ? "구부정한 자세" : "중립 정렬";
    }

    function easeInOutCubic(x) {
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    }

    function play() {
      if (reduceMotion) {
        spine.render(1);
        setState(1);
        return;
      }
      if (animating) return;
      animating = true;

      var duration = 2200;
      var startedAt = null;

      function step(now) {
        if (startedAt === null) startedAt = now;
        var progress = Math.min(1, (now - startedAt) / duration);
        var eased = easeInOutCubic(progress);
        spine.render(eased);
        setState(eased);
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          animating = false;
        }
      }

      spine.render(0);
      setState(0);
      requestAnimationFrame(step);
    }

    spine.render(reduceMotion ? 1 : 0);
    setState(reduceMotion ? 1 : 0);

    if (replay) {
      replay.addEventListener("click", play);
    }

    if (!reduceMotion) {
      if ("IntersectionObserver" in window && figure) {
        var spineObserver = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting) {
                play();
                spineObserver.disconnect();
              }
            });
          },
          { threshold: 0.3 }
        );
        spineObserver.observe(figure);
      } else {
        window.setTimeout(play, 400);
      }
    }
  }

  /* ------------------------------------------------------------- 예약 문의 */

  var form = document.getElementById("bookingForm");
  var notice = document.getElementById("formNotice");

  function showNotice(html) {
    if (!notice) return;
    notice.innerHTML = html;
    notice.classList.add("is-shown");
  }

  if (form) {
    if (CONFIG.formEndpoint) {
      form.setAttribute("action", CONFIG.formEndpoint);
      form.setAttribute("method", "post");
    }

    form.addEventListener("submit", function (event) {
      if (CONFIG.formEndpoint) return; // 연결된 주소로 그대로 전송

      event.preventDefault();

      var name = form.elements.name.value.trim();
      var tel = form.elements.tel.value.trim();

      if (!name || !tel) {
        showNotice("성함과 연락처를 입력해 주세요. 두 가지만 있으면 예약 가능한 시간을 안내해 드릴 수 있습니다.");
        return;
      }

      var telHref = "tel:" + CONFIG.phone.replace(/[^0-9+]/g, "");
      showNotice(
        "온라인 예약 접수는 아직 연결되지 않았습니다. 전화 <a href=\"" +
          telHref +
          "\">" +
          CONFIG.phone +
          "</a> 로 연락 주시면 바로 예약 도와드리겠습니다."
      );
    });
  }

  /* --------------------------------------------------------- 카카오톡 채널 */

  ["kakaoLink", "kakaoDock"].forEach(function (id) {
    var link = document.getElementById(id);
    if (!link) return;

    if (CONFIG.kakaoUrl) {
      link.setAttribute("href", CONFIG.kakaoUrl);
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener");
      return;
    }

    link.addEventListener("click", function (event) {
      event.preventDefault();
      var contact = document.getElementById("contact");
      if (contact) contact.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
      showNotice("카카오톡 채널이 아직 연결되지 않았습니다. 아래 양식이나 전화로 문의해 주세요.");
    });
  });
})();
