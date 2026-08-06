// 1. FIREBASE IMPORTS
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

// 2. CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyDAzMDcP2b7cN7cFRPI2LMV0JaGG1pSmvM",
    authDomain: "pehramani-jewellery.firebaseapp.com",
    projectId: "pehramani-jewellery",
    storageBucket: "pehramani-jewellery.firebasestorage.app",
    messagingSenderId: "1020807957770",
    appId: "1:1020807957770:web:3c9ab1196599d64c2bfef3"
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 3. STATE
let products = [];
let cart = JSON.parse(localStorage.getItem('pehramaniCart')) || [];
const WHATSAPP_NUMBER = '919082037084';

// 4. HELPERS
function money(value) {
    return `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;
}

function getProductPrice(product) {
    return Number(product?.discount_price && product.discount_price < product.price ? product.discount_price : (product?.price || product?.discount_price || 0));
}

function getProductById(id) {
    return products.find(product => String(product.id) === String(id));
}

function escapeHTML(value = '') {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

// 5. DATA FETCH & SYNCHRONIZATION
async function fetchProducts() {
    try {
        console.log("Fetching products from Firestore...");
        const querySnapshot = await getDocs(collection(db, "Products"));
        
        const localProductsList = [];
        querySnapshot.forEach((doc) => {
            localProductsList.push({ id: doc.id, ...doc.data() });
        });

        products = localProductsList;
        console.log(`SUCCESS: Loaded ${products.length} products into memory.`);

        renderShopCatalog(products);
        renderHomeFeatured(products);
        renderDynamicCategories(products);
        renderDynamicFilterButtons(products);
        renderFooterDynamicShopList(products);
        
        syncCartWithLatestProducts();
        renderCart();

    } catch (e) {
        console.error("Error fetching products:", e);
        renderCart();
    }
}

function syncCartWithLatestProducts() {
    if (!products.length || !cart.length) return;
    cart = cart.map(cartItem => {
        const latestProduct = getProductById(cartItem.id);
        if (latestProduct) {
            return {
                ...latestProduct,
                quantity: cartItem.quantity || 1,
                category: latestProduct.category || latestProduct.Category || 'Jewellery',
                image: latestProduct.image || latestProduct.Image || ''
            };
        }
        return cartItem;
    });
    saveCart();
}

function saveCart() {
    localStorage.setItem('pehramaniCart', JSON.stringify(cart));
}

function updateCartCount() {
    const count = cart.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
    const cartCount = document.getElementById('cart-count');
    if (cartCount) cartCount.innerText = count;
}

function cartTotal() {
    return cart.reduce((sum, item) => sum + (getProductPrice(item) * Number(item.quantity || 1)), 0);
}

// 6. RENDER ENGINE & FOOTER DYNAMIC CATEGORIES
function renderFooterDynamicShopList(list) {
    const footerShopList = document.getElementById('footer-dynamic-shop-list');
    if (!footerShopList || !list || list.length === 0) return;

    const uniqueCategories = new Set();
    list.forEach(p => {
        const catVal = p.category || p.Category;
        if (catVal) uniqueCategories.add(catVal.trim());
    });

    let listHtml = `<li><a href="#" onclick="navigateTo('view-shop'); triggerFooterCategoryFilter('all', event)">All Collections</a></li>`;
    
    uniqueCategories.forEach(cat => {
        const safeCat = cat.replace(/'/g, "\\'"); // Handles apostrophes safely
        listHtml += `<li><a href="#" onclick="navigateTo('view-shop'); setTimeout(()=>triggerFooterCategoryFilter('${safeCat}'), 120);">${escapeHTML(cat)}</a></li>`;
    });

    footerShopList.innerHTML = listHtml;
}

// 2. Dedicated trigger that forces both page routing, filtering, AND correct button states
window.triggerFooterCategoryFilter = (categoryName) => {
    const targetCatLower = categoryName.toLowerCase().trim();
    
    // Find all filter buttons at the top of the shop catalog
    const filterButtons = document.querySelectorAll('.btn-filter');
    
    filterButtons.forEach(btn => {
        const btnText = btn.innerText.toLowerCase().trim();
        if (btnText === targetCatLower || (targetCatLower === 'all' && btnText === 'all')) {
            // Style as Selected (Black background, white text)
            btn.style.background = '#111';
            btn.style.color = '#fff';
            btn.style.borderColor = '#111';
            btn.classList.add('target-filter-active');
        } else {
            // Style as Unselected (White background, black text)
            btn.style.background = '#fff';
            btn.style.color = '#111';
            btn.style.borderColor = '#eaeaea';
            btn.classList.remove('target-filter-active');
        }
    });

    // Execute the filter logic on the product grid items
    const productCards = document.querySelectorAll('#shop-catalog-grid .product-card');
    productCards.forEach(card => {
        const productCategory = (card.getAttribute('data-category') || '').toLowerCase().trim();
        if (targetCatLower === 'all' || productCategory === targetCatLower) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
};

// Helper function that filters products AND visually highlights the matching button at the top
window.selectCategoryButtonAndFilter = (categoryName) => {
    // 1. Find all filter buttons at the top of the shop page
    const filterButtons = document.querySelectorAll('.btn-filter');
    
    filterButtons.forEach(btn => {
        const btnText = btn.innerText.toLowerCase().trim();
        if (btnText === categoryName.toLowerCase().trim()) {
            // Apply active/selected button styling
            btn.style.background = '#111';
            btn.style.color = '#fff';
            btn.style.borderColor = '#111';
            btn.classList.add('target-filter-active');
        } else {
            // Reset unselected buttons
            btn.style.background = '#fff';
            btn.style.color = '#111';
            btn.style.borderColor = '#eaeaea';
            btn.classList.remove('target-filter-active');
        }
    });

    // 2. Run the product filter logic
    filterCategory(categoryName);
};
function renderDynamicCategories(list) {
    const categoryGrid = document.querySelector('.category-bubble')?.parentElement?.parentElement;
    if (!categoryGrid || !list || list.length === 0) return;

    const uniqueCategories = {};
    list.forEach(p => {
        const catVal = p.category || p.Category;
        if (catVal && !uniqueCategories[catVal.toLowerCase()]) {
            uniqueCategories[catVal.toLowerCase()] = p.image;
        }
    });

    let dynamicGridHtml = '';
    Object.keys(uniqueCategories).forEach(cat => {
        dynamicGridHtml += `
            <div onclick="navigateTo('view-shop'); setTimeout(()=>filterCategory('${cat}'), 100);">
                <div class="category-bubble">
                    <img src="${escapeHTML(uniqueCategories[cat])}" style="object-position: center center;">
                </div>
                <span style="font-weight:600; font-size:0.9em; letter-spacing:1px; cursor:pointer;">${cat.toUpperCase()}</span>
            </div>
        `;
    });

    if (dynamicGridHtml) {
        categoryGrid.innerHTML = dynamicGridHtml;
    }
}

function renderDynamicFilterButtons(list) {
    const filterContainer = document.getElementById('dynamic-filter-container');
    if (!filterContainer || !list || list.length === 0) return;

    const uniqueCategories = new Set();
    list.forEach(p => {
        const catVal = p.category || p.Category;
        if (catVal) uniqueCategories.add(catVal.trim());
    });

    let buttonsHtml = `
        <button class="btn-filter target-filter-active" onclick="filterCategory('all', event)" style="padding: 10px 24px; background: #111; color: #fff; border: 1px solid #111; cursor: pointer; font-family: 'Inter', sans-serif; font-size: 0.85em; font-weight: 600; letter-spacing: 1px; border-radius: 30px;">ALL</button>
    `;

    uniqueCategories.forEach(cat => {
        buttonsHtml += `
            <button class="btn-filter" onclick="filterCategory('${escapeHTML(cat.toLowerCase())}', event)" style="padding: 10px 24px; background: #fff; color: #111; border: 1px solid #eaeaea; cursor: pointer; font-family: 'Inter', sans-serif; font-size: 0.85em; font-weight: 600; letter-spacing: 1px; border-radius: 30px;">${escapeHTML(cat.toUpperCase())}</button>
        `;
    });

    filterContainer.innerHTML = buttonsHtml;
}

function renderShopCatalog(list) {
    const grid = document.getElementById('shop-catalog-grid');
    if (!grid) return;
    grid.innerHTML = list.length
        ? list.map(p => generateProductCardHTML(p)).join('')
        : '<p style="text-align:center; width:100%; color: #9C948B; font-weight: 500; padding: 40px 0;">Collections Coming Soon. Check back shortly!</p>';
}

function renderHomeFeatured(list) {
    const homeGrid = document.getElementById('home-featured-grid');
    if (!homeGrid) return;

    let featured = list.filter(p => (p.badge && p.badge.toLowerCase() === 'bestseller')).slice(0, 4);
    if (featured.length === 0) featured = list.slice(0, 4);

    homeGrid.innerHTML = featured.length
        ? featured.map(p => generateProductCardHTML(p)).join('')
        : '<p style="text-align:center; width:100%; color: #9C948B; font-weight: 500; padding: 40px 0;">Collections Coming Soon. Check back shortly!</p>';
}

function generateProductCardHTML(p) {
    let priceHTML = '';
    if (p.discount_price && p.discount_price < p.price) {
        priceHTML = `
            <span style="text-decoration: line-through; color: #888; font-size: 0.9em; margin-right: 5px;">${money(p.price)}</span>
            <strong style="color: #C59B4E; font-size: 1.1em;">${money(p.discount_price)}</strong>`;
    } else {
        priceHTML = `<strong style="font-size: 1.1em;">${money(getProductPrice(p))}</strong>`;
    }

    const badgeHTML = p.badge
        ? `<span style="position: absolute; top: 10px; left: 10px; background: #C59B4E; color: #fff; padding: 4px 10px; font-size: 10px; font-weight: bold; border-radius: 2px; z-index: 2; text-transform: uppercase; letter-spacing: 1px;">${escapeHTML(p.badge)}</span>`
        : '';

    const productCategory = p.category || p.Category || 'Jewellery';

    return `
        <div class="product-card" data-category="${escapeHTML(productCategory.toLowerCase())}" style="position: relative; background: #fff; border: 1px solid #eaeaea; transition: box-shadow 0.3s ease; display: flex; flex-direction: column; justify-content: space-between;">
            ${badgeHTML}
            <div class="product-image-frame" onclick="viewProductDetails('${p.id}')" style="cursor: pointer; width: 100%; aspect-ratio: 1/1; overflow: hidden; background: #fbfbfb;">
                <img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://via.placeholder.com/400x400?text=Image+Not+Found'">
                <div class="quick-view-overlay">View Details</div>
            </div>
            <div style="padding: 20px 15px; text-align: center; flex-grow: 1; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <p style="font-size: 0.75em; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">${escapeHTML(productCategory)}</p>
                    <h3 onclick="viewProductDetails('${p.id}')" style="cursor:pointer; margin: 0 0 10px 0; font-size: 1.2em; font-family: 'Playfair Display', serif; font-weight: 600; color: #111;">${escapeHTML(p.name)}</h3>
                    <p class="price" style="margin-bottom: 15px;">${priceHTML}</p>
                </div>
                <button class="add-btn" onclick="addToCart('${p.id}')" style="width: 100%; padding: 12px; background: #111; color: #fff; border: none; cursor: pointer; font-family: 'Inter', sans-serif; font-weight: 500; font-size: 0.9em;">
                    ADD TO CART
                </button>
            </div>
        </div>`;
}

function renderProductDetail(product) {
    const container = document.getElementById('product-detail-container');
    if (!container) return;

    const priceHTML = product.discount_price && product.discount_price < product.price
        ? `<span style="text-decoration:line-through; color:#9C948B; font-size:18px; margin-right:10px;">${money(product.price)}</span><span>${money(product.discount_price)}</span>`
        : `<span>${money(getProductPrice(product))}</span>`;

    const productCategory = product.category || product.Category || 'Jewellery';

    container.innerHTML = `
        <button onclick="navigateTo('view-shop')" class="pdp-back-btn"><i class="fa-solid fa-arrow-left"></i> Back to Collection</button>
        <div class="pdp-layout">
            <div class="pdp-gallery">
                <img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" onerror="this.src='https://via.placeholder.com/800x800?text=Image+Not+Found'">
            </div>
            <div class="pdp-details">
                ${product.badge ? `<span class="pdp-badge">${escapeHTML(product.badge)}</span>` : ''}
                <p class="product-style-tag">${escapeHTML(productCategory)}</p>
                <h1>${escapeHTML(product.name)}</h1>
                <div class="pdp-price">${priceHTML}</div>
                <p class="pdp-description">${escapeHTML(product.description || 'A curated Pehramani statement piece designed to elevate your everyday and occasion looks.')}</p>
                <div class="pdp-specs">
                    <div class="spec-line"><strong>Category:</strong> ${escapeHTML(productCategory)}</div>
                    <div class="spec-line"><strong>Material:</strong> ${escapeHTML(product.material || 'Premium fashion jewellery')}</div>
                </div>
                <div class="pdp-actions">
                    <button class="btn shimmer-btn" style="width: 100%; padding: 16px; font-size: 14px;" onclick="addToCart('${product.id}', true)">Add To Cart</button>
                </div>
            </div>
        </div>
    `;
}

function renderCart() {
    const cartItemsContainer = document.getElementById('cart-items');
    const cartTotalEl = document.getElementById('cart-total');
    if (!cartItemsContainer || !cartTotalEl) return;

    updateCartCount();
    cartTotalEl.innerText = money(cartTotal());

    if (!cart.length) {
        cartItemsContainer.innerHTML = '<p class="empty-cart-message">Your cart is empty.</p>';
        return;
    }

    cartItemsContainer.innerHTML = cart.map(item => `
        <div class="cart-item">
            <img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}" onerror="this.src='https://via.placeholder.com/200x200?text=Image+Not+Found'">
            <div class="cart-item-details">
                <h4>${escapeHTML(item.name)}</h4>
                <p>${money(getProductPrice(item))}</p>
                <div class="cart-qty-controls">
                    <button onclick="changeCartQuantity('${item.id}', -1)">-</button>
                    <span>${item.quantity || 1}</span>
                    <button onclick="changeCartQuantity('${item.id}', 1)">+</button>
                </div>
                <button class="remove-item-btn" onclick="removeFromCart('${item.id}')">Remove</button>
            </div>
        </div>
    `).join('');
}

// 7. ROUTER & FILTERS
window.filterCategory = (selectedCategory, event) => {
    const filterButtons = document.querySelectorAll('.btn-filter');
    filterButtons.forEach(btn => {
        btn.style.background = '#fff'; btn.style.color = '#111'; btn.style.borderColor = '#eaeaea';
    });
    if (event && event.currentTarget) {
        event.currentTarget.style.background = '#111';
        event.currentTarget.style.color = '#fff';
        event.currentTarget.style.borderColor = '#111';
    }
    
    const productCards = document.querySelectorAll('#shop-catalog-grid .product-card');
    productCards.forEach(card => {
        const productCategory = (card.getAttribute('data-category') || '').toLowerCase().trim();
        if (selectedCategory === 'all' || productCategory === selectedCategory.toLowerCase().trim()) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
};

window.handleNewsletterSubmit = async function(e) {
    e.preventDefault();
    const emailInput = document.getElementById('newsletter-email');
    try {
        await addDoc(collection(db, "Newsletter_Subscribers"), {
            email: emailInput.value.trim(),
            subscribed_at: new Date()
        });
        alert('Thank you for subscribing to Pehramani alerts! ✨');
        emailInput.value = '';
    } catch (err) {
        alert('Service busy. Please try again.');
    }
};

window.navigateTo = (pageId) => {
    const sections = document.querySelectorAll('.view-section');
    sections.forEach(section => {
        section.style.display = 'none';
        section.classList.remove('active');
    });

    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.style.display = 'block';
        targetPage.classList.add('active');
        window.scrollTo(0, 0);
    }
};

window.handleGlobalSearch = (event) => {
    window.navigateTo('view-shop');
    const term = event.target.value.toLowerCase().trim();
    renderShopCatalog(products.filter(p => {
        const cat = p.category || p.Category || '';
        const desc = p.description || '';
        return (p.name && p.name.toLowerCase().includes(term)) ||
               (cat.toLowerCase().includes(term)) ||
               (desc.toLowerCase().includes(term));
    }));
};

window.viewProductDetails = (id) => {
    const product = getProductById(id);
    if (!product) return alert('Product details are loading. Please try again.');
    renderProductDetail(product);
    window.navigateTo('view-product-detail');
};

window.addToCart = (id, openDrawer = false) => {
    const product = getProductById(id);
    if (!product) return alert('Product is not available right now.');

    const existingItem = cart.find(item => String(item.id) === String(id));
    if (existingItem) {
        existingItem.quantity = Number(existingItem.quantity || 1) + 1;
    } else {
        cart.push({
            ...product,
            quantity: 1,
            category: product.category || product.Category || 'Jewellery',
            image: product.image || product.Image || ''
        });
    }

    saveCart();
    renderCart();
    showCartToast(`${product.name} added to your cart.`);
    if (openDrawer) window.openCart();
};

window.changeCartQuantity = (id, change) => {
    const item = cart.find(cartItem => String(cartItem.id) === String(id));
    if (!item) return;

    item.quantity = Number(item.quantity || 1) + change;
    if (item.quantity <= 0) {
        cart = cart.filter(cartItem => String(cartItem.id) !== String(id));
    }

    saveCart();
    renderCart();
};

window.removeFromCart = (id) => {
    cart = cart.filter(item => String(item.id) !== String(id));
    saveCart();
    renderCart();
};

window.openCart = () => {
    renderCart();
    document.getElementById('cart-drawer')?.classList.add('open');
    document.getElementById('cart-overlay')?.classList.add('open');
};

window.closeCart = () => {
    document.getElementById('cart-drawer')?.classList.remove('open');
    document.getElementById('cart-overlay')?.classList.remove('open');
};

window.toggleCart = () => {
    const drawer = document.getElementById('cart-drawer');
    if (drawer?.classList.contains('open')) window.closeCart();
    else window.openCart();
};

window.checkoutWhatsApp = () => {
    if (!cart.length) return alert('Your cart is empty. Please add an item first.');

    const targetField = document.getElementById('delivery-address') || document.querySelector('textarea[placeholder*="address"]');
    const locationInput = targetField ? targetField.value.trim() : '';

    if (!locationInput) {
        alert('Delivery Address is strictly required to verify routing coordinates!');
        if (targetField) targetField.focus();
        return;
    }

    const orderDate = new Date();
    const dateString = orderDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replaceAll('/', '.');

    let receiptRowsHtml = '';
    let textInvoiceLines = [];

    cart.forEach((item, index) => {
        const dbProduct = products.find(p => String(p.id) === String(item.id)) || item;
        const itemCategory = String(dbProduct.category || dbProduct.Category || 'Jewellery').trim();
        const itemImage = String(dbProduct.image || dbProduct.Image || '').trim();
        const itemName = String(dbProduct.name || dbProduct.Name || item.name || 'Unnamed Item').trim();
        const itemQty = item.quantity || 1;
        const itemPrice = money(getProductPrice(dbProduct));
        const itemSubtotal = money(getProductPrice(dbProduct) * Number(itemQty));

        receiptRowsHtml += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 0; font-size: 13px; border-bottom: 1px solid #F5F5F4;">
                <div style="flex: 2.5; text-align: left; padding-right: 10px;">
                    <span style="color: #1C1917; font-weight: 500; display: block;">${itemName}</span>
                    <span style="font-size: 10px; color: #78716C; text-transform: uppercase;">${itemCategory}</span>
                </div>
                <div style="flex: 1; text-align: right;">${itemPrice}</div>
                <div style="flex: 1; text-align: center;">${itemQty}</div>
                <div style="flex: 1; text-align: right; font-weight: 600;">${itemSubtotal}</div>
            </div>
        `;

        // Detailed text structure for WhatsApp containing Name, Category, Price, Qty, and Image link
        textInvoiceLines.push(
            `🔹 *Item ${index + 1}:* ${itemName}\n` +
            `📂 *Category:* ${itemCategory}\n` +
            `💰 *Price:* ${itemPrice} x ${itemQty} = ${itemSubtotal}\n` +
            `🖼️ *Image Link:* ${itemImage}`
        );
    });

    let invoiceIdHeader = cart.length === 1 ? String(cart[0].id || '0000').toUpperCase() : `PEHRA-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    const totalBalance = money(cartTotal());
    const targetArea = document.getElementById('receipt-print-area');

    if (targetArea) {
        targetArea.innerHTML = `
            <div class="invoice-canvas-paper" style="background: #FFFFFF; padding: 60px 50px; color: #1C1917; text-align: left;">
                <h2>INVOICE</h2>
                <p><strong>Invoice No:</strong> #${invoiceIdHeader}</p>
                <p><strong>Date:</strong> ${dateString}</p>
                <hr style="margin:20px 0;">
                ${receiptRowsHtml}
                <h3 style="margin-top:20px;">Cart Total: ${totalBalance}</h3>
            </div>
        `;
        document.getElementById('receipt-modal-container').style.display = 'flex';
    }

    // Formatted message payload containing all requested parameters for WhatsApp
    const dispatchMessage =
        `✨ *New Order Placed - Pehramani* ✨\n\n` +
        `🆔 *Invoice Number:* #${invoiceIdHeader}\n` +
        `📅 *Date:* ${dateString}\n\n` +
        `🛍️ *Order Items:*\n\n` +
        `${textInvoiceLines.join('\n\n-------------------\n\n')}\n\n` +
        `━━━━━━━━━━━━━━━\n` +
        `💳 *Cart Total:* ${totalBalance}\n` +
        `━━━━━━━━━━━━━━━\n\n` +
        `📍 *Delivery Address:* \n${locationInput}\n\n` +
        `_Thank you for shopping with Pehramani!_`;

    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(dispatchMessage)}`, '_blank');
};

function showCartToast(message) {
    let toast = document.getElementById('cart-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'cart-toast';
        document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
}

window.fetchProducts = fetchProducts;
window.addEventListener('DOMContentLoaded', () => {
    renderCart();
    fetchProducts();
});
