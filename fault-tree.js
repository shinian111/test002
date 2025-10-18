
// 故障数据加载器
        class FaultDataLoader {
            constructor() {
                this.basePath = 'data/';
                this.faultTree = document.getElementById('faultTree');
                this.infoDisplay = document.getElementById('infoDisplay');
                this.noteBox = document.getElementById('noteBox');
                this.noteContent = document.getElementById('noteContent');
                this.searchInput = document.getElementById('searchInput');
                this.noResults = document.querySelector('.no-results');
                this.treeLoading = document.getElementById('treeLoading');
                this.currentNote = null;
                this.nodeMap = new Map(); // 存储节点ID与数据的映射
            }
            
            // 初始化
            async init() {
                try {
                    await this.loadMainData();
                    this.setupEventListeners();
                } catch (error) {
                    console.error('初始化失败:', error);
                    this.treeLoading.innerHTML = '<p>加载故障数据失败，请检查网络连接</p>';
                }
            }
            
            // 加载主JSON文件
            async loadMainData() {
                try {
                    const response = await fetch(`${this.basePath}main.json`);
                    const data = await response.json();
                    this.treeLoading.style.display = 'none';
                    this.buildTree(data, this.faultTree);
                } catch (error) {
                    console.error('加载故障数据失败:', error);
                    this.treeLoading.innerHTML = '<p>加载故障数据失败，请检查网络连接</p>';
                }
            }
            
            // 递归构建树状结构
            buildTree(data, parentElement, level = 0, parentId = 'root') {
                data.forEach((item, index) => {
                    const nodeId = `${parentId}-${index}`;
                    const li = document.createElement('li');
                    const node = document.createElement('div');
                    node.className = 'node';
                    node.id = nodeId;
                    
                    // 判断是否为文件夹（有子节点）
                    const hasChildren = item.children && item.children.length > 0;
                    const isExternalFile = item.file && !hasChildren;
                    const iconClass = hasChildren ? 'fas fa-folder' : 
                                     (isExternalFile ? 'fas fa-external-link-alt' : 'fas fa-file-medical');
                    
                    node.innerHTML = `
                        <i class="${iconClass}"></i>
                        <span class="node-text">${item.title}</span>
                    `;
                    
                    // 存储节点数据
                    this.nodeMap.set(nodeId, item);
                    
                    li.appendChild(node);
                    
                    // 如果有子节点，递归构建
                    if (hasChildren) {
                        const ul = document.createElement('ul');
                        this.buildTree(item.children, ul, level + 1, nodeId);
                        li.appendChild(ul);
                    }
                    
                    parentElement.appendChild(li);
                });
            }
            
            // 设置事件监听器
            setupEventListeners() {
                // 使用事件委托处理节点点击
                this.faultTree.addEventListener('click', async (e) => {
                    const node = e.target.closest('.node');
                    if (!node) return;
                    
                    e.stopPropagation();
                    
                    // 移除所有节点的active类
                    document.querySelectorAll('.node.active').forEach(n => {
                        n.classList.remove('active');
                    });
                    
                    // 为当前节点添加active类
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
                    
                    // 处理节点内容显示
                    await this.displayNodeContent(node);
                });
                
                // 搜索功能
                this.searchInput.addEventListener('input', () => {
                    this.searchNodes();
                });
            }
            
            // 显示节点内容
            async displayNodeContent(node) {
                const nodeId = node.id;
                const nodeData = this.nodeMap.get(nodeId);
                
                if (!nodeData) return;
                
                // 显示或隐藏注意事项
                if (nodeData.note) {
                    this.noteContent.innerHTML = nodeData.note;
                    this.noteBox.style.display = 'block';
                } else {
                    // 如果没有当前节点的注意事项，查找父节点的注意事项
                    this.findParentNote(node);
                }
                
                // 如果有外部文件，加载文件内容
                if (nodeData.file) {
                    try {
                        const response = await fetch(`${this.basePath}${nodeData.file}`);
                        const fileData = await response.json();
                        this.updateInfoDisplay(fileData);
                    } catch (error) {
                        console.error('加载故障详情失败:', error);
                        this.infoDisplay.innerHTML = '<p>加载故障详情失败</p>';
                    }
                } else if (nodeData.measures && nodeData.rootCause) {
                    // 直接显示节点内容
                    this.updateInfoDisplay(nodeData);
                } else {
                    // 如果没有具体内容，显示默认信息
                    this.infoDisplay.innerHTML = `
                        <div class="placeholder-text">
                            <i class="fas fa-hand-pointer"></i>
                            <p>请选择具体的故障项查看详细信息</p>
                        </div>
                    `;
                }
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
                            this.noteContent.innerHTML = parentData.note;
                            this.noteBox.style.display = 'block';
                            foundNote = true;
                        }
                    }
                    
                    parent = parent.parentNode.closest('li');
                }
                
                if (!foundNote) {
                    this.noteBox.style.display = 'none';
                }
            }
            
            // 更新信息显示区域
            updateInfoDisplay(data) {
                const formattedMeasures = data.measures ? data.measures.replace(/\n/g, '<br>') : '';
                const formattedRootCause = data.rootCause ? data.rootCause.replace(/\n/g, '<br>') : '';
                
                this.infoDisplay.innerHTML = `
                    <div class="info-section">
                        <h3 class="info-header"><i class="fas fa-tools"></i>维修措施</h3>
                        <div class="info-content">
                            ${formattedMeasures}
                        </div>
                    </div>
                    <hr>
                    <div class="info-section">
                        <h3 class="info-header"><i class="fas fa-search"></i>根本原因</h3>
                        <div class="info-content">
                            ${formattedRootCause}
                        </div>
                    </div>
                    <hr>
                    <div class="info-section">
                        <h3 class="info-header"><i class="fas fa-lightbulb"></i>维修建议</h3>
                        <div class="info-content">
                            <ul>
                                <li>执行维修措施前，请先确认故障现象是否一致</li>
                                <li>处理高压部件时，请确保设备已断电且压力释放</li>
                                <li>更换部件后需进行功能测试</li>
                                <li>如维修后问题仍存在，请升级报告</li>
                            </ul>
                        </div>
                    </div>
                `;
            }
            
            // 搜索节点
            searchNodes() {
                const searchTerm = this.searchInput.value.toLowerCase().trim();
                const allNodes = document.querySelectorAll('.tree li');
                let found = false;
                
                // 隐藏"未找到结果"消息
                this.noResults.style.display = 'none';
                
                // 如果没有搜索词，显示所有节点
                if (!searchTerm) {
                    allNodes.forEach(li => {
                        li.style.display = 'list-item';
                        const ul = li.querySelector('ul');
                        if (ul) {
                            ul.style.display = 'none';
                        }
                    });
                    return;
                }
                
                // 遍历所有节点
                allNodes.forEach(li => {
                    const node = li.querySelector('.node');
                    if (!node) return;
                    
                    const nodeId = node.id;
                    const nodeData = this.nodeMap.get(nodeId);
                    const nodeText = nodeData ? nodeData.title.toLowerCase() : 
                                    node.querySelector('.node-text').textContent.toLowerCase();
                    
                    if (nodeText.includes(searchTerm)) {
                        // 显示匹配的节点及其所有子节点
                        li.style.display = 'list-item';
                        this.showAllChildren(li);
                        
                        // 展开所有父节点
                        this.expandAllParents(li);
                        
                        found = true;
                    } else {
                        // 检查子节点是否有匹配
                        const childMatch = this.checkChildrenForMatch(li, searchTerm);
                        if (childMatch) {
                            li.style.display = 'list-item';
                            this.expandAllParents(li);
                            found = true;
                        } else {
                            li.style.display = 'none';
                        }
                    }
                });
                
                // 如果没有找到匹配项
                if (!found) {
                    this.noResults.style.display = 'block';
                }
            }
            
            // 显示所有子节点
            showAllChildren(li) {
                const ul = li.querySelector('ul');
                if (ul) {
                    ul.style.display = 'block';
                    const childLis = ul.querySelectorAll('li');
                    childLis.forEach(childLi => {
                        childLi.style.display = 'list-item';
                        this.showAllChildren(childLi); // 递归显示所有子节点
                    });
                    
                    // 更新文件夹图标
                    const icon = li.querySelector('.fa-folder, .fa-folder-open');
                    if (icon) {
                        icon.classList.remove('fa-folder');
                        icon.classList.add('fa-folder-open');
                    }
                }
            }
            
            // 检查子节点是否有匹配
            checkChildrenForMatch(li, searchTerm) {
                const ul = li.querySelector('ul');
                if (ul) {
                    const childNodes = ul.querySelectorAll('.node');
                    for (let node of childNodes) {
                        const nodeId = node.id;
                        const nodeData = this.nodeMap.get(nodeId);
                        const nodeText = nodeData ? nodeData.title.toLowerCase() : 
                                        node.querySelector('.node-text').textContent.toLowerCase();
                        
                        if (nodeText.includes(searchTerm)) {
                            return true;
                        }
                        
                        // 递归检查子节点
                        const childLi = node.closest('li');
                        if (childLi && this.checkChildrenForMatch(childLi, searchTerm)) {
                            return true;
                        }
                    }
                }
                return false;
            }
            
            // 展开所有父节点
            expandAllParents(li) {
                let parentLi = li.parentNode.closest('li');
                while (parentLi) {
                    parentLi.style.display = 'list-item';
                    const ul = parentLi.querySelector('ul');
                    if (ul) {
                        ul.style.display = 'block';
                        
                        // 更新文件夹图标
                        const icon = parentLi.querySelector('.fa-folder, .fa-folder-open');
                        if (icon) {
                            icon.classList.remove('fa-folder');
                            icon.classList.add('fa-folder-open');
                        }
                    }
                    
                    parentLi = parentLi.parentNode.closest('li');
                }
            }
        }
        
        // 页面加载完成后初始化
        document.addEventListener('DOMContentLoaded', function() {
            const loader = new FaultDataLoader();
            loader.init();
        });

