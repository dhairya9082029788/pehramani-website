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
        
        // Use a local temporary array first to prevent multi-threading reference drops
        const localProductsList = [];
        querySnapshot.forEach((doc) => {
            localProductsList.push({ id: doc.id, ...doc.data() });
        });

        // Mutate the global reference in a single clean cycle
        products = localProductsList;
        console.log(`SUCCESS: Loaded ${products.length} products into memory.`);

        // Pass the populated list directly into the render pipelines
        renderShopCatalog(products);
        renderHomeFeatured(products);
        renderDynamicCategories(products);
        renderDynamicFilterButtons(products);
        
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

// 6. RENDER ENGINE
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
            <div onclick="navigateTo('view-shop'); setTimeout(()=>filterCategory('${cat}', {currentTarget: document.querySelector('.btn-filter')}), 100);">
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
        if (catVal) {
            uniqueCategories.add(catVal.trim());
        }
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
                <img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease;" onerror="this.src='https://via.placeholder.com/400x400?text=Image+Not+Found'" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                <div class="quick-view-overlay">View Details</div>
            </div>
            <div style="padding: 20px 15px; text-align: center; flex-grow: 1; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <p style="font-size: 0.75em; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">${escapeHTML(productCategory)}</p>
                    <h3 onclick="viewProductDetails('${p.id}')" style="cursor:pointer; margin: 0 0 10px 0; font-size: 1.2em; font-family: 'Playfair Display', serif; font-weight: 600; color: #111;">${escapeHTML(p.name)}</h3>
                    <p class="price" style="margin-bottom: 15px;">${priceHTML}</p>
                </div>
                <button class="add-btn" onclick="addToCart('${p.id}')" style="width: 100%; padding: 12px; background: #111; color: #fff; border: none; cursor: pointer; font-family: 'Inter', sans-serif; font-weight: 500; font-size: 0.9em; transition: background 0.3s ease;" onmouseover="this.style.background='#C59B4E'" onmouseout="this.style.background='#111'">
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
                    <div class="spec-line"><strong>Availability:</strong> ${escapeHTML(product.stock_status || 'Available')}</div>
                </div>
                <ul class="why-love-list">
                    <li>Curated from Mumbai-inspired statement jewellery trends.</li>
                    <li>Perfect for gifting, festive styling, and everyday luxury looks.</li>
                    <li>Secure WhatsApp checkout support for quick order confirmation.</li>
                </ul>
                <div class="pdp-actions">
                    <button class="btn shimmer-btn" onclick="addToCart('${product.id}', true)">Add To Cart</button>
                    <button class="btn whatsapp-pdp-btn" onclick="checkoutSingleProductWhatsApp('${product.id}')"><i class="fa-brands fa-whatsapp"></i> Buy on WhatsApp</button>
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

// 7. INTERACTIVE ACTION DISPATCHERS
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
            card.style.opacity = 1;
            card.style.transform = 'translateY(0)';
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

window.handleContactSubmit = async function(e) {
    e.preventDefault();
    try {
        await addDoc(collection(db, "Contact_Inquiries"), {
            name: document.getElementById('contact-name').value.trim(),
            email: document.getElementById('contact-email').value.trim(),
            message: document.getElementById('contact-message').value.trim(),
            received_at: new Date()
        });
        alert('Message received! We will contact you soon.');
        e.target.reset();
    } catch (err) {
        alert('Error parsing form configurations.');
    }
};

// 8. GLOBAL ROUTER BINDINGS & ATTACHMENTS (FIXES UNCLICKABLE INTERFACE)
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
        // Explicitly pull both lowercase and uppercase keys so they are saved in the cart state
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
        const itemImage = String(dbProduct.image || dbProduct.Image || 'https://via.placeholder.com/400x400?text=No+Image+Found').trim();
        const itemName = String(dbProduct.name || dbProduct.Name || item.name || 'Unnamed Item').trim();
        
        const itemQty = item.quantity || 1;
        const itemPrice = money(getProductPrice(dbProduct));
        const itemSubtotal = money(getProductPrice(dbProduct) * Number(itemQty));

        receiptRowsHtml += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 0; font-size: 13px; font-weight: 500; border-bottom: 1px solid #F5F5F4;">
                <div style="flex: 2.5; text-align: left; padding-right: 10px;">
                    <span style="color: #1C1917; font-weight: 500; display: block;">${itemName}</span>
                    <span style="font-size: 10px; color: #78716C; text-transform: uppercase; letter-spacing: 0.5px;">${itemCategory}</span>
                </div>
                <div style="flex: 1; text-align: right; color: #44403C;">${itemPrice}</div>
                <div style="flex: 1; text-align: center; color: #44403C;">${itemQty}</div>
                <div style="flex: 1; text-align: right; font-weight: 600; color: #1C1917;">${itemSubtotal}</div>
            </div>
        `;

        textInvoiceLines.push(`${index + 1}. ${itemName}\n   Qty: ${itemQty} | Subtotal: ${itemSubtotal}\n   Image Link: ${itemImage}`);
    });

    // SMART INVOICE REF: Shows item ID for single purchases, or a clean batch code for 8-10 multiple items
    let invoiceIdHeader = '';
    if (cart.length === 1) {
        invoiceIdHeader = String(cart[0].id || '0000').toUpperCase();
    } else {
        const monthToken = orderDate.toLocaleString('en-US', { month: 'short' }).toUpperCase();
        const dayToken = orderDate.getDate().toString().padStart(2, '0');
        const sessionToken = Math.random().toString(36).substring(2, 5).toUpperCase();
        invoiceIdHeader = `PEHRA-${monthToken}${dayToken}-${sessionToken}`;
    }

    const totalBalance = money(cartTotal());
    const targetArea = document.getElementById('receipt-print-area');

    if (targetArea) {
        targetArea.innerHTML = `
            <div class="invoice-canvas-paper" style="background: #FFFFFF; padding: 60px 50px; color: #1C1917; text-align: left; height: auto;">
                
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px;">
                    <div>
                        <span style="font-size: 14px; font-weight: 700; letter-spacing: 0.5px; color: #1C1917; display: block; margin-bottom: 20px;">${dateString}</span>
                        
              <div class="invoice-banner-trigger" style="position: relative; height: 56px; margin-left: -50px; margin-top: 15px; margin-bottom: 25px; display: inline-block; width: 260px;">
                  <div style="position: absolute; left: 0; top: 0; width: 210px; height: 56px; background-color: #1C1917; z-index: 1;"></div>
                  
                  <div style="position: absolute; left: 182px; top: 0; width: 56px; height: 56px; background-color: #1C1917; border-radius: 50%; z-index: 1;"></div>
                  
                  <div style="position: absolute; left: 25px; top: 0; height: 56px; display: flex; align-items: center; z-index: 10;">
                      <h1 style="font-family: 'Inter', sans-serif; font-size: 24px; font-weight: 700; margin: 0; letter-spacing: 4px; text-transform: uppercase; color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF !important;">INVOICE</h1>
                  </div>
              </div>
                        
                        <div style="margin-top: 25px; font-size: 12px; font-weight: 700; color: #1C1917; letter-spacing: 1px;">
                            INVOICE NO <span style="font-weight: 500; color: #57524E; margin-left: 8px;"># ${invoiceIdHeader}</span>
                        </div>
                    </div>
                    
                    <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
                        <div style="width: 70px; height: 70px; border: 1px dashed #78716C; border-radius: 50%; display: flex; flex-direction: column; justify-content: center; align-items: center; margin-bottom: 25px; position: relative;">
                            <i class="fa-solid fa-leaf" style="font-size: 14px; color: #C59B4E; margin-bottom: 2px;"></i>
                            <span style="font-size: 7px; font-weight: 900; letter-spacing: 1px; color: #1C1917; text-transform: uppercase; line-height: 1;">PEHRAMANI</span>
                        </div>
                        
                        <span style="font-size: 11px; font-weight: 700; letter-spacing: 1px; color: #1C1917; margin-bottom: 6px; text-transform: uppercase;">INVOICE TO:</span>
                        <span style="font-size: 12px; color: #44403C; font-weight: 500; margin-bottom: 2px;">Client Care Account</span>
                        <span style="font-size: 11px; color: #78716C; font-weight: 400;">pehramani@gmail.com</span>
                    </div>
                </div>

                <div class="invoice-decorative-line">
                    <div class="invoice-decorative-line-inner"></div>
                </div>
                
                <div class="invoice-table-header" style="display: flex; justify-content: space-between; padding: 4px 0;">
                    <div style="flex: 2.5; text-align: left;">DESCRIPTION</div>
                    <div style="flex: 1; text-align: right;">PRICE</div>
                    <div style="flex: 1; text-align: center;">QTY</div>
                    <div style="flex: 1; text-align: right;">TOTAL</div>
                </div>

                <div class="invoice-decorative-line" style="margin-bottom: 10px;">
                    <div class="invoice-decorative-line-inner"></div>
                </div>

                <div style="height: auto; min-height: 120px; margin-bottom: 15px;">
                    ${receiptRowsHtml}
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; font-size: 12px; font-weight: 700; color: #1C1917; text-transform: uppercase; letter-spacing: 1px;">
                    <span>TOTAL</span>
                    <span>${totalBalance}</span>
                </div>
                
                <div class="invoice-decorative-line" style="margin-top: 5px; margin-bottom: 25px;">
                    <div class="invoice-decorative-line-inner"></div>
                </div>

                <div style="display: flex; flex-direction: column; align-items: flex-end; width: 100%; margin-bottom: 30px; padding-right: 5px; font-size: 13px;">
                    <div style="display: flex; justify-content: space-between; width: 160px; margin-bottom: 8px; color: #57524E; font-weight: 500;">
                        <span>Total:</span>
                        <span>${totalBalance}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; width: 160px; margin-bottom: 15px; color: #78716C; font-size: 12px;">
                        <span>Tax (0%):</span>
                        <span>Rs. 0</span>
                    </div>
                    <div style="background: #1C1917; color: #FFFFFF; padding: 10px 20px; border-radius: 20px; display: flex; justify-content: space-between; width: 200px; font-weight: 700;">
                        <span style="font-size: 11px; letter-spacing: 1px; text-transform: uppercase; display: flex; align-items: center; color: #FFFFFF;">Grand : Total</span>
                        <span style="color: #C59B4E; font-size: 14px;">${totalBalance}</span>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px;">
                    <div style="font-size: 11px; color: #78716C; line-height: 1.6; max-width: 280px; text-align: left;">
                        <strong style="color: #1C1917; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">Shipping Destination:</strong>
                        ${escapeHTML(locationInput)}
                    </div>
                    <div style="font-family: 'Playfair Display', serif; font-size: 28px; font-style: italic; color: #1C1917; font-weight: 500; letter-spacing: 0.5px; padding-right: 15px; transform: rotate(-3deg);">
                        Thank You
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('receipt-modal-container').style.display = 'flex';
    }

    const dispatchMessage = `Hello Pehramani,\n\nI have just placed an order!\n\nDate: ${dateString}\nInvoice Reference: ${invoiceIdHeader}\n\nItems Ordered:\n${textInvoiceLines.join('\n\n')}\n\nOrder Total: ${totalBalance}\n\nDelivery Destination Address:\n${locationInput}\n\nClient Contact: pehramani@gmail.com`;
    
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(dispatchMessage)}`, '_blank');
};

// Global Print Window Frame Trigger Method Configuration
// Updated print command helper - completely independent of external CSS conflicts
// Fixed print helper - preserves flex columns without stripping layout styles
// NEW FEATURE: Seamlessly screenshot and download the exact Canva UI design as an Image file
// FIXED CAPTURE FUNCTION: Forces full canvas height calculations to include the entire footer
window.downloadInvoiceImage = () => {
    const targetElement = document.getElementById('receipt-print-area');
    const scrollContainer = document.getElementById('receipt-print-area-wrapper');
    if (!targetElement || !scrollContainer) return alert('Receipt element snapshot failed.');

    // 1. Temporarily remove scroll restrictions so html2canvas reads the full document height
    const originalModalHeight = scrollContainer.style.maxHeight;
    const originalModalOverflow = scrollContainer.style.overflowY;
    
    scrollContainer.style.maxHeight = 'none';
    scrollContainer.style.overflowY = 'visible';

    // 2. High-resolution capture configurations
    const captureOptions = {
        scale: 2,                     // Keeps lines and text sharp
        useCORS: true,                // Loads icons safely
        backgroundColor: '#FFFFFF',   // Solid card background color
        logging: false,
        windowWidth: targetElement.scrollWidth,
        windowHeight: targetElement.scrollHeight // Forces capture engine to read to the absolute bottom line
    };

    html2canvas(targetElement, captureOptions).then((canvas) => {
        const rawImageData = canvas.toDataURL('image/png');
        const orderDate = new Date().toISOString().split('T')[0];
        
        const invisibleLink = document.createElement('a');
        invisibleLink.download = `Pehramani-Receipt-${orderDate}.png`;
        invisibleLink.href = rawImageData;
        
        document.body.appendChild(invisibleLink);
        invisibleLink.click();
        document.body.removeChild(invisibleLink);

        // 3. Re-enforce original browser scroll container mechanics for screen responsiveness
        scrollContainer.style.maxHeight = originalModalHeight;
        scrollContainer.style.overflowY = originalModalOverflow;
    }).catch(err => {
        console.error("Image capture engine drop error:", err);
        // Fallback restoration if capture engine stumbles
        scrollContainer.style.maxHeight = originalModalHeight;
        scrollContainer.style.overflowY = originalModalOverflow;
        alert("Unable to process high-resolution snapshot download stream.");
    });
};

window.checkoutSingleProductWhatsApp = (id) => {
    const product = getProductById(id);
    if (!product) return alert('Product is not available right now.');

    const targetField = document.getElementById('delivery-address') || document.querySelector('textarea[placeholder*="address"]');
    const locationInput = targetField ? targetField.value.trim() : '';

    if (!locationInput) {
        alert('Delivery Address is strictly required to verify routing coordinates!');
        if (targetField) targetField.focus();
        return;
    }

    const message = `Hello Pehramani,\n\nI would like to order this product:\n\nProduct: ${product.name}\nCategory: ${product.category || 'Jewellery'}\nPrice: ${money(getProductPrice(product))}\nMaterial: ${product.material || 'Premium fashion jewellery'}\n\nDelivery Destination Address:\n${locationInput}`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
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

window.toggleAIChatWindow = () => {
    const chatElement = document.getElementById('ai-chat-body-window');
    if (chatElement) {
        chatElement.style.display = chatElement.style.display === 'none' ? 'block' : 'none';
    }
};

window.fetchProducts = fetchProducts;

// 9. INITIALIZATION
window.addEventListener('DOMContentLoaded', () => {
    renderCart();
    fetchProducts();
});
