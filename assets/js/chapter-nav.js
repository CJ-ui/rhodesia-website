// Scrollspy + smooth-scroll for the Constitution and History sidebar navigation.
document.addEventListener("DOMContentLoaded", function () {
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".doc-nav a"));
  if (!navLinks.length) return;

  var sections = navLinks
    .map(function (link) {
      var id = link.getAttribute("href").replace("#", "");
      return document.getElementById(id);
    })
    .filter(Boolean);

  var linkById = {};
  navLinks.forEach(function (link) {
    linkById[link.getAttribute("href").replace("#", "")] = link;
  });

  function setActive(id) {
    navLinks.forEach(function (link) {
      link.classList.remove("is-active");
    });
    var active = linkById[id];
    if (active) {
      active.classList.add("is-active");
      var chapterItem = active.closest("li");
      var parentChapterLink = chapterItem && chapterItem.parentElement
        ? chapterItem.parentElement.closest("li")
        : null;
      if (parentChapterLink) {
        var chapterAnchor = parentChapterLink.querySelector(":scope > a");
        if (chapterAnchor) chapterAnchor.classList.add("is-active");
      }
    }
  }

  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );

    sections.forEach(function (section) {
      observer.observe(section);
    });
  }

  navLinks.forEach(function (link) {
    link.addEventListener("click", function (e) {
      var id = link.getAttribute("href").replace("#", "");
      var target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        history.replaceState(null, "", "#" + id);
        setActive(id);
      }
    });
  });
});
