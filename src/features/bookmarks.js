export function initBookmarks(){
  const imageGrid=document.getElementById('image-grid');
  const tabsContainer=document.getElementById('bookmarkTabsContainer');
  const addTabBtn=document.getElementById('addBookmarkTabBtn');
  const toggleEditBtn=document.getElementById('toggleBookmarkEditBtn');
  let editMode=false;
  const genId=()=> 'btab_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,7);
  const escapeHtml=(str)=>String(str??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const getTabs=()=>{
    const tabs=Array.isArray(window.__bookmarkTabList)&&window.__bookmarkTabList.length ? window.__bookmarkTabList : [{id:'default',name:'기본',order:0}];
    return [...tabs].sort((a,b)=>(a.order??0)-(b.order??0));
  };
  const renderTabs=()=>{
    if(!tabsContainer) return;
    const tabs=getTabs();
    if(!tabs.some(t=>t.id===window.__bookmarkActiveTabId)) window.__bookmarkActiveTabId=tabs[0]?.id||'default';
    tabsContainer.innerHTML='';
    tabs.forEach(t=>{
      const btn=document.createElement('button');
      btn.className='bookmark-tab'+(t.id===window.__bookmarkActiveTabId?' active':'');
      btn.dataset.tabId=t.id;
      btn.draggable=editMode;
      btn.innerHTML=`<span class="tab-label">${escapeHtml(t.name||'탭')}</span>${editMode?`<span class="tab-del" title="삭제">×</span>`:''}`;
      tabsContainer.appendChild(btn);
    });
    if(toggleEditBtn){
      toggleEditBtn.innerHTML= editMode
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
    }
  };
  const renderAll=()=>{ renderTabs(); if(typeof renderImageBookmarks==='function') renderImageBookmarks(); };
  window.renderBookmarkTabsUI=renderAll;

  tabsContainer?.addEventListener('click', async (e)=>{
    const tabBtn=e.target.closest('.bookmark-tab');
    if(!tabBtn) return;
    const tabId=tabBtn.dataset.tabId;
    if(editMode && e.target.classList.contains('tab-del')){
      if(!confirm('이 탭과 탭 안의 북마크를 삭제할까요?')) return;
      window.cloudDeleteBookmarkTab && await window.cloudDeleteBookmarkTab(tabId);
      return;
    }
    window.__bookmarkActiveTabId=tabId;
    window.cloudSetActiveBookmarkTab && await window.cloudSetActiveBookmarkTab(tabId);
    renderAll();
  });
  tabsContainer?.addEventListener('dblclick', async (e)=>{
    const tabBtn=e.target.closest('.bookmark-tab'); if(!tabBtn) return;
    const tabId=tabBtn.dataset.tabId;
    const cur=getTabs().find(t=>t.id===tabId);
    const name=prompt('탭 이름 변경', cur?.name||'');
    if(name===null) return;
    const trimmed=name.trim().slice(0,20);
    if(trimmed) window.cloudRenameBookmarkTab && await window.cloudRenameBookmarkTab(tabId, trimmed);
  });
  addTabBtn?.addEventListener('click', async ()=>{
    const name=prompt('새 북마크 탭 이름','새 탭');
    if(name===null) return;
    const trimmed=name.trim().slice(0,20);
    if(!trimmed) return;
    const id=genId();
    window.cloudAddBookmarkTab && await window.cloudAddBookmarkTab({id,name:trimmed});
  });
  toggleEditBtn?.addEventListener('click',()=>{ editMode=!editMode; renderTabs(); });

  let draggingEl=null, placeholderEl=null;
  function ensurePlaceholder(width){
    if(placeholderEl) return;
    placeholderEl=document.createElement('div');
    placeholderEl.className='bookmark-tab placeholder';
    placeholderEl.style.width=(width||80)+'px';
    placeholderEl.style.height='32px';
    placeholderEl.style.border='1px dashed rgba(255,255,255,.25)';
    placeholderEl.style.background='transparent';
  }
  function getDragAfterElement(container,x){
    const els=[...container.querySelectorAll('.bookmark-tab:not(.dragging):not(.placeholder)')];
    let closest={offset:Number.NEGATIVE_INFINITY,element:null};
    for(const child of els){
      const box=child.getBoundingClientRect();
      const offset=x-(box.left+box.width/2);
      if(offset<0 && offset>closest.offset) closest={offset,element:child};
    }
    return closest.element;
  }
  tabsContainer?.addEventListener('dragstart',(e)=>{
    if(!editMode) return;
    const tabBtn=e.target.closest('.bookmark-tab'); if(!tabBtn) return;
    draggingEl=tabBtn; draggingEl.classList.add('dragging');
    ensurePlaceholder(tabBtn.getBoundingClientRect().width);
    placeholderEl.style.width=tabBtn.getBoundingClientRect().width+'px';
    tabBtn.after(placeholderEl);
    if(e.dataTransfer) e.dataTransfer.effectAllowed='move';
  });
  tabsContainer?.addEventListener('dragover',(e)=>{
    if(!editMode || !draggingEl) return;
    e.preventDefault();
    const afterEl=getDragAfterElement(tabsContainer,e.clientX);
    if(!afterEl) tabsContainer.appendChild(placeholderEl); else tabsContainer.insertBefore(placeholderEl,afterEl);
  });
  async function finalizeReorder(){
    if(!draggingEl || !placeholderEl) return;
    placeholderEl.replaceWith(draggingEl); draggingEl.classList.remove('dragging');
    const ids=[...tabsContainer.querySelectorAll('.bookmark-tab')].filter(el=>!el.classList.contains('placeholder')).map(el=>el.dataset.tabId).filter(Boolean);
    const map=new Map(getTabs().map(t=>[t.id,t]));
    const next=ids.map((id,i)=>({...map.get(id),order:i*10})).filter(Boolean);
    window.cloudReorderBookmarkTabs && await window.cloudReorderBookmarkTabs(next);
    draggingEl=null; placeholderEl=null;
  }
  tabsContainer?.addEventListener('drop',async(e)=>{ if(!editMode) return; e.preventDefault(); await finalizeReorder(); });
  tabsContainer?.addEventListener('dragend',async()=>{ if(editMode && placeholderEl && draggingEl) await finalizeReorder(); });

  renderAll();
}
