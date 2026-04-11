/* =================================================
JF GADAI - MAIN GLOBAL JS
Global interactions for all pages
Safe for static GitHub Pages
================================================= */


/* =========================================
FADE-IN ANIMATION
========================================= */

document.addEventListener("DOMContentLoaded", function () {

    const elements = document.querySelectorAll(".fade-in");

    if ("IntersectionObserver" in window) {

        const observer = new IntersectionObserver(function(entries){

            entries.forEach(function(entry){

                if(entry.isIntersecting){

                    entry.target.classList.add("visible");

                }

            });

        }, { threshold: 0.2 });

        elements.forEach(function(el){
            observer.observe(el);
        });

    }

});


/* =========================================
SMOOTH SCROLL (anchor links)
========================================= */

document.querySelectorAll('a[href^="#"]').forEach(function(anchor){

    anchor.addEventListener("click", function(e){

        const target = document.querySelector(this.getAttribute("href"));

        if(target){

            e.preventDefault();

            target.scrollIntoView({
                behavior: "smooth"
            });

        }

    });

});


/* =========================================
LAZY IMAGE LOADING (SEO + speed)
========================================= */

document.addEventListener("DOMContentLoaded", function(){

    const lazyImages = document.querySelectorAll("img[data-src]");

    if(!lazyImages.length) return;

    if("IntersectionObserver" in window){

        const imgObserver = new IntersectionObserver(function(entries, observer){

            entries.forEach(function(entry){

                if(entry.isIntersecting){

                    const img = entry.target;

                    img.src = img.dataset.src;

                    img.removeAttribute("data-src");

                    observer.unobserve(img);

                }

            });

        });

        lazyImages.forEach(function(img){
            imgObserver.observe(img);
        });

    }

});


/* =========================================
MOBILE NAV SUPPORT (future ready)
========================================= */

function toggleMenu(){

    const nav = document.querySelector(".nav-actions");

    if(nav){

        nav.classList.toggle("nav-open");

    }

}


/* =========================================
SAFE CONSOLE LOG (debug only)
========================================= */

console.log("JF Gadai main.js loaded");

/* =========================================
AUTO COPYRIGHT YEAR
========================================= */
// 自动更新年份
document.getElementById('year').textContent = new Date().getFullYear();
