
// fault-tree.js - 完整的设备故障处理系统
class FaultTree {
    constructor() {
        // 初始化DOM元素
        this.treeElement = document.getElementById('faultTree');
        this.infoDisplay = document.getElementById('infoDisplay');
        this.noteBox = document.getElementById('noteBox');
        this.noteContent = document.getElementById('noteContent');
        this.searchInput = document.getElementById('searchInput');
        this.noResults = document.getElementById('noResults');
        this.treeLoading = document.getElementById('treeLoading');
       
        // 图片模态框相关
        this.imageModal = document.createElement('div');
        this.imageModal.className = 'image-modal';
        this.imageModal.innerHTML = `
            <span class="close-modal">&times;</span>
            <img class="modal-content" id="modalImage">
        `;
        document.body.appendChild(this.imageModal);
       
        // 初始化状态
        this.basePath = 'data/';
        this.nodeMap = new Map();
        this.fileCache = new Map();
        this.currentNote = null;
        this.imageObserver = null;
       
        // 开始初始化
        this.init();
    }
   
    async init() {
        try {
            // 加载主JSON数据
            const mainData = await this.loadJSONFile('main.json');
            this.buildTree(mainData, this.treeElement);
           
            // 设置事件监听
            this.setupEventListeners();
           
            // 初始化图片懒加载
            this.initImageLazyLoad();
           
            // 隐藏加载指示器
            if (this.treeLoading) {
                this.treeLoading.style.display = 'none';
            }
        } catch (error) {
            console.error('初始化失败:', error);
            this.showError('加载故障数据失败，请检查网络连接');
        }
    }
   
    // 加载JSON文件（带缓存）
    async loadJSONFile(filePath) {
        // 检查缓存
        if (this.fileCache.has(filePath)) {
            return this.fileCache.get(filePath);
        }
       
        // 处理路径
        const fullPath = filePath.startsWith('/')
            ? `${this.basePath}${filePath.substring(1)}`
            : `${this.basePath}${filePath}`;
       
        const response = await fetch(fullPath);
        if (!response.ok) throw new Error(`加载失败: ${filePath}`);
       
        const data = await response.json();
        this.fileCache.set(filePath, data);
        return data;
    }
   
    // 递归构建树状结构
    // 修复后的buildTree方法
buildTree(data, parentElement, level = 0, parentId = 'root') {
    data.forEach((item, index) => {
        const nodeId = `${parentId}-${index}`;
        const li = document.createElement('li');
        const node = document.createElement('div');
        node.className = 'node';
        node.id = nodeId; // 设置ID
       
        // 设置图标
        const hasChildren = item.children && item.children.length > 0;
        const isExternalFile = item.file && !hasChildren;
        const iconClass = hasChildren ? 'fas fa-folder' :
                         (isExternalFile ? 'fas fa-external-link-alt' : 'fas fa-file-medical');
       
        node.innerHTML = `
            <i class="${iconClass}"></i>
            <span class="node-text">${item.title}</span>
        `;
       
        // 设置数据属性
        node.setAttribute('data-title', item.title);
        if (item.measures) node.setAttribute('data-measures', item.measures);
        if (item.rootCause) node.setAttribute('data-root-cause', item.rootCause);
        if (item.note) node.setAttribute('data-note', item.note);
        if (item.file) node.setAttribute('data-file', item.file);
       
        // 存储到nodeMap
        this.nodeMap.set(nodeId, item);
       
        li.appendChild(node);
       
        // 递归构建子节点
        if (hasChildren) {
            const ul = document.createElement('ul');
            li.appendChild(ul);
            this.buildTree(item.children, ul, level + 1, nodeId);
        }
       
        parentElement.appendChild(li);
    });
}
   
    // 设置事件监听
    setupEventListeners() {
        // 节点点击事件
        this.treeElement.addEventListener('click', async (e) => {
            const node = e.target.closest('.node');
            if (!node) return;
           
            e.stopPropagation();
           
            // 更新活动节点
            document.querySelectorAll('.node.active').forEach(n => n.classList.remove('active'));
            node.classList.add('active');
           
            // 处理文件夹展开/折叠
            if (node.querySelector('.fa-folder, .fa-folder-open')) {
                const icon = node.querySelector('.fa-folder, .fa-folder-open');
                const childList = node.parentNode.querySelector('ul');
               
                if (childList) {
                    if (childList.style.display === 'none' || !childList.style.display) {
                        childList.style.display = 'block';
                        icon.classList.remove('fa-folder');
                        icon.classList.add('fa-folder-open');
                    } else {
                        childList.style.display = 'none';
                        icon.classList.remove('fa-folder-open');
                        icon.classList.add('fa-folder');
                    }
                }
            }
           
            // 显示节点内容
            await this.displayNodeContent(node);
        });
       
        // 搜索功能
        this.searchInput.addEventListener('input', () => this.searchNodes());
       
        // 图片模态框
        this.imageModal.querySelector('.close-modal').addEventListener('click', () => {
            this.imageModal.style.display = 'none';
        });
       
        this.imageModal.addEventListener('click', (e) => {
            if (e.target === this.imageModal) {
                this.imageModal.style.display = 'none';
            }
        });
    }
   
    // 显示节点内容
    async displayNodeContent(node) {
        const nodeId = node.id;
        const nodeData = this.nodeMap.get(nodeId);
       
        if (!nodeData) return;
       
        // 处理注意事项
        if (nodeData.note) {
            this.showNote(nodeData.note);
        } else {
            this.findParentNote(node);
        }
       
        // 加载内容
        try {
            let displayData = nodeData;
           
            // 如果有外部文件，加载文件内容
            if (nodeData.file) {
                displayData = await this.loadJSONFile(nodeData.file);
            }
           
            // 更新显示
            this.updateInfoDisplay(displayData);
        } catch (error) {
            console.error('加载内容失败:', error);
            this.showError('加载故障详情失败');
        }
    }
   
    // 更新信息显示区域
    updateInfoDisplay(data) {
        const formattedMeasures = data.measures ? data.measures.replace(/\n/g, '<br>') : '';
        const formattedRootCause = data.rootCause ? data.rootCause.replace(/\n/g, '<br>') : '';
        const imagesHTML = data.images ? this.generateImagesHTML(data.images) : '';
       
        this.infoDisplay.innerHTML = `
            <div class="info-section">
                <h3 class="info-header"><i class="fas fa-tools"></i> 维修措施</h3>
                <div class="info-content">${formattedMeasures}</div>
            </div>
            ${imagesHTML}
            <div class="info-section">
                <h3 class="info-header"><i class="fas fa-search"></i> 根本原因</h3>
                <div class="info-content">${formattedRootCause}</div>
            </div>
        `;
       
        // 初始化新加载的图片
        this.initLazyLoadForNewImages();
        this.setupImageClickEvents();
    }
   
    // 生成图片HTML
    generateImagesHTML(images) {
        if (!images || !images.length) return '';
       
        if (images.length === 1) {
            const img = images[0];
            return `
                <div class="image-section">
                    <div class="image-container">
                        <img class="fault-image lazy-image"
                             data-src="${img.url}"
                             alt="${img.caption || ''}">
                        ${img.caption ? `<div class="image-caption">${img.caption}</div>` : ''}
                    </div>
                </div>
            `;
        } else {
            const thumbnails = images.map((img, index) => `
                <div class="thumbnail-container">
                    <img class="thumbnail lazy-image"
                         data-src="${img.url}"
                         alt="${img.caption || ''}"
                         data-index="${index}">
                    ${img.caption ? `<div class="thumbnail-caption">${img.caption}</div>` : ''}
                </div>
            `).join('');
           
            return `
                <div class="image-section">
                    <h4 class="image-header"><i class="fas fa-images"></i> 相关图片</h4>
                    <div class="image-grid">${thumbnails}</div>
                </div>
            `;
        }
    }
   
    // 初始化图片懒加载
    initImageLazyLoad() {
        if (this.imageObserver) {
            this.imageObserver.disconnect();
        }
       
        this.imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.add('loaded');
                    this.imageObserver.unobserve(img);
                }
            });
        }, { rootMargin: '100px' });
       
        document.querySelectorAll('.lazy-image:not(.loaded)').forEach(img => {
            this.imageObserver.observe(img);
        });
    }
   
    // 设置图片点击事件
    setupImageClickEvents() {
        document.querySelectorAll('.fault-image, .thumbnail').forEach(img => {
            img.addEventListener('click', (e) => {
                const src = e.target.currentSrc || e.target.dataset.src;
                this.openImageModal(src);
            });
        });
    }
   
    // 打开图片模态框
    openImageModal(src) {
        const modalImg = this.imageModal.querySelector('#modalImage');
        modalImg.src = src;
        this.imageModal.style.display = 'flex';
    }
   
    // 显示注意事项
    showNote(note) {
        this.noteContent.innerHTML = note;
        this.noteBox.style.display = 'block';
        this.currentNote = note;
    }
   
    // 查找父节点的注意事项
    findParentNote(node) {
        let parent = node.parentNode.closest('li');
        let foundNote = false;
       
        while (parent && !foundNote) {
            const parentNode = parent.querySelector('.node');
            if (parentNode) {
                const parentId = parentNode.id;
                const parentData = this.nodeMap.get(parentId);
               
                if (parentData && parentData.note) {
                    this.showNote(parentData.note);
                    foundNote = true;
                }
            }
           
            parent = parent.parentNode.closest('li');
        }
       
        if (!foundNote) {
            this.noteBox.style.display = 'none';
            this.currentNote = null;
        }
    }
   
    // 搜索节点
    searchNodes() {
        const searchTerm = this.searchInput.value.toLowerCase().trim();
        const allNodes = document.querySelectorAll('.tree li');
        let foundAny = false;
       
        this.noResults.style.display = 'none';
       
        if (!searchTerm) {
            // 重置搜索状态
            allNodes.forEach(li => {
                li.style.display = 'flex';
                const ul = li.querySelector('ul');
                if (ul) ul.style.display = 'none';
            });
            return;
        }
       
        allNodes.forEach(li => {
            const node = li.querySelector('.node');
            const nodeText = node.getAttribute('data-title').toLowerCase();
            const hasMatch = nodeText.includes(searchTerm);
            const childMatch = this.checkChildrenForMatch(li, searchTerm);
           
            if (hasMatch || childMatch) {
                li.style.display = 'flex';
                this.expandAllParents(li);
                if (childMatch) this.showAllChildren(li);
                foundAny = true;
            } else {
                li.style.display = 'none';
            }
        });
       
        if (!foundAny) {
            this.noResults.style.display = 'block';
        }
    }
   
    // 检查子节点是否有匹配
    checkChildrenForMatch(li, searchTerm) {
        const childNodes = li.querySelectorAll('.node');
        for (let node of childNodes) {
            const nodeText = node.getAttribute('data-title').toLowerCase();
            if (nodeText.includes(searchTerm)) {
                return true;
            }
           
            // 递归检查子节点
            const childLi = node.closest('li');
            if (childLi && this.checkChildrenForMatch(childLi, searchTerm)) {
                return true;
            }
        }
        return false;
    }
   
    // 显示所有子节点
    showAllChildren(li) {
        const ul = li.querySelector('ul');
        if (ul) {
            ul.style.display = 'block';
            const childLis = ul.querySelectorAll('li');
            childLis.forEach(childLi => {
                childLi.style.display = 'flex';
                this.showAllChildren(childLi);
            });
           
            // 更新文件夹图标
            const icon = li.querySelector('.fa-folder, .fa-folder-open');
            if (icon) {
                icon.classList.remove('fa-folder');
                icon.classList.add('fa-folder-open');
            }
        }
    }
   
    // 展开所有父节点
    expandAllParents(li) {
        let parent = li.parentNode.closest('li');
        while (parent) {
            parent.style.display = 'flex';
            const parentUl = parent.querySelector('ul');
            if (parentUl) parentUl.style.display = 'block';
           
            const parentIcon = parent.querySelector('.fa-folder, .fa-folder-open');
            if (parentIcon) {
                parentIcon.classList.remove('fa-folder');
                parentIcon.classList.add('fa-folder-open');
            }
           
            parent = parent.parentNode.closest('li');
        }
    }
   
    // 显示错误信息
    showError(message) {
        this.infoDisplay.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${message}</p>
            </div>
        `;
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    new FaultTree();
});
