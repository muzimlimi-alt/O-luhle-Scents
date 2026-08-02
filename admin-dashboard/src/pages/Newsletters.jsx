import React, { useState, useEffect, useCallback, useRef } from 'react';
import { newsletterApi } from '../services/api';
import { 
  Users, Mail, Plus, Search, Filter, Trash2,
  RefreshCw, CheckCircle, XCircle, Send, Paperclip, Edit2
} from 'lucide-react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { useMessaging } from '../context/MessagingContext';

const quillModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike', 'blockquote'],
    [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
    ['link', 'image'],
    ['clean']
  ],
};


export function Newsletters() {
  const { showMessage } = useMessaging();
  const [activeTab, setActiveTab] = useState('subscribers'); // subscribers | campaigns

  // SUBSCRIBERS STATE
  const [subscribers, setSubscribers] = useState([]);
  const [subLoading, setSubLoading] = useState(true);
  const [subSearch, setSubSearch] = useState('');
  const [subStatus, setSubStatus] = useState('all');
  const [subPage, setSubPage] = useState(1);
  const [subTotalPages, setSubTotalPages] = useState(1);
  const [subTotal, setSubTotal] = useState(0);
  const [subStartDate, setSubStartDate] = useState('');
  const [subEndDate, setSubEndDate] = useState('');

  // CAMPAIGNS STATE
  const [campaigns, setCampaigns] = useState([]);
  const [campLoading, setCampLoading] = useState(true);
  const [campPage, setCampPage] = useState(1);
  const [campTotalPages, setCampTotalPages] = useState(1);
  const [campTotal, setCampTotal] = useState(0);
  const [campStartDate, setCampStartDate] = useState('');
  const [campEndDate, setCampEndDate] = useState('');

  // MODALS STATE
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [newSubEmail, setNewSubEmail] = useState('');
  const [subError, setSubError] = useState(null);
  const [selectedSubscribers, setSelectedSubscribers] = useState(new Set());
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);
  
  const [isCampModalOpen, setIsCampModalOpen] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [campForm, setCampForm] = useState({ id: null, subject: '', contentHtml: '', attachments: [] });
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const quillRef = useRef(null);
  const quillInstance = useRef(null);

  /* --- SUBSCRIBERS LOGIC --- */
  const fetchSubscribers = useCallback(async () => {
    setSubLoading(true);
    try {
      const response = await newsletterApi.subscribers.list({
        page: subPage,
        limit: 15,
        status: subStatus !== 'all' ? subStatus : undefined,
        startDate: subStartDate || undefined,
        endDate: subEndDate || undefined,
      });
      // Basic Frontend filtering for search since backend doesn't have search query built in
      let filtered = response.subscribers || [];
      if (subSearch) {
        filtered = filtered.filter(s => s.email.toLowerCase().includes(subSearch.toLowerCase()));
      }
      setSubscribers(filtered);
      setSubTotalPages(Math.ceil((response.total || 0) / 15) || 1);
      setSubTotal(response.total || 0);
    } catch (err) {
      console.error('Failed to load subscribers:', String(err));
    } finally {
      setSubLoading(false);
    }
  }, [subPage, subStatus, subSearch, subStartDate, subEndDate]);

  useEffect(() => {
    if (activeTab === 'subscribers') {
      const timer = setTimeout(() => fetchSubscribers(), 300);
      return () => clearTimeout(timer);
    }
  }, [activeTab, fetchSubscribers]);

  const handleAddSubscriber = async (e) => {
    e.preventDefault();
    setSubError(null);
    try {
      const resp = await newsletterApi.subscribers.create({ email: newSubEmail, source: 'admin', addedBy: 'Dashboard Admin' });
      if (resp && (resp.type === 'warning' || resp.type === 'error')) {
        setSubError(resp.message);
        return;
      }
      setIsSubModalOpen(false);
      setNewSubEmail('');
      fetchSubscribers();
    } catch (error) {
      setSubError(error.message || 'Failed to add subscriber');
    }
  };

  const handleToggleSubStatus = async (sub) => {
    try {
      const newStatus = sub.status === 'active' ? 'unsubscribed' : 'active';
      await newsletterApi.subscribers.updateStatus(sub.id, newStatus);
      showMessage('success', 'Status Updated', `${sub.email} is now ${newStatus}.`);
      fetchSubscribers();
    } catch (err) {
      showMessage('error', 'Update Failed', err.message || 'Unable to update subscriber status.');
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmTarget) return;
    const { id, type } = deleteConfirmTarget;
    try {
      if (type === 'subscriber') {
        await newsletterApi.subscribers.delete(id);
        showMessage('success', 'Subscriber Deleted', 'The entry has been permanently removed.');
        fetchSubscribers();
      } else if (type === 'campaign') {
        await newsletterApi.campaigns.delete(id);
        showMessage('success', 'Campaign Deleted', 'The draft has been cleared.');
        fetchCampaigns();
      }
      setDeleteConfirmTarget(null);
    } catch (err) {
      showMessage('error', 'Deletion Error', err.message || 'Something went wrong during deletion.');
    }
  };

  const handleToggleSelectAll = (e) => {
    if (e.target.checked) setSelectedSubscribers(new Set(subscribers.map(s => s.id)));
    else setSelectedSubscribers(new Set());
  };

  const handleToggleSelect = (id) => {
    const nextState = new Set(selectedSubscribers);
    if (nextState.has(id)) nextState.delete(id);
    else nextState.add(id);
    setSelectedSubscribers(nextState);
  };

  const handleBulkAction = async (action) => {
    if (selectedSubscribers.size === 0) return;
    if (!window.confirm(`Are you sure you want to mass-${action} ${selectedSubscribers.size} subscribers?`)) return;
    try {
      await newsletterApi.subscribers.bulkAction({ ids: Array.from(selectedSubscribers), action });
      showMessage('success', 'Bulk Action Complete', `Successfully ${action}d ${selectedSubscribers.size} subscribers.`);
      setSelectedSubscribers(new Set());
      fetchSubscribers();
    } catch (err) {
      showMessage('error', 'Bulk Action Failed', err.message);
    }
  };

  /* --- CAMPAIGNS LOGIC --- */
  const fetchCampaigns = useCallback(async () => {
    setCampLoading(true);
    try {
      const response = await newsletterApi.campaigns.list({
        page: campPage,
        limit: 15,
        startDate: campStartDate || undefined,
        endDate: campEndDate || undefined,
      });
      setCampaigns(response.campaigns || []);
      setCampTotalPages(Math.ceil((response.total || 0) / 15) || 1);
      setCampTotal(response.total || 0);
    } catch (err) {
      console.error('Failed to load campaigns:', String(err));
    } finally {
      setCampLoading(false);
    }
  }, [campPage, campStartDate, campEndDate]);

  useEffect(() => {
    if (activeTab === 'campaigns') {
      fetchCampaigns();
    }
  }, [activeTab, fetchCampaigns]);

  useEffect(() => {
    if (isCampModalOpen) {
      const timer = setTimeout(() => setEditorReady(true), 200);
      return () => clearTimeout(timer);
    } else {
      setEditorReady(false);
      quillInstance.current = null; // Reset instance on close
    }
  }, [isCampModalOpen]);

  useEffect(() => {
    if (editorReady && quillRef.current && !quillInstance.current) {
      quillInstance.current = new Quill(quillRef.current, {
        theme: 'snow',
        modules: quillModules
      });
      
      if (campForm.contentHtml) {
        quillInstance.current.root.innerHTML = campForm.contentHtml;
      }

      quillInstance.current.getModule('toolbar').addHandler('image', () => {
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'image/*');
        input.click();

        input.onchange = async () => {
          const file = input.files[0];
          if (!file) return;

          // Add a loading indicator in the editor maybe? 
          // For now, let's just upload
          try {
            const res = await newsletterApi.campaigns.uploadImage(file);
            const range = quillInstance.current.getSelection();
            quillInstance.current.insertEmbed(range.index, 'image', res.url);
            showMessage('success', 'Image Uploaded', 'Embedded image has been optimized and added.');
          } catch (error) {
            console.error('Image upload failed:', error);
            showMessage('error', 'Image Failed', 'Could not upload the embedded image.');
          }
        };
      });

      quillInstance.current.on('text-change', () => {
        const html = quillInstance.current.root.innerHTML;
        setCampForm(prev => {
          if (prev.contentHtml === html) return prev;
          return { ...prev, contentHtml: html };
        });
      });
    }
  }, [editorReady, campForm.contentHtml, showMessage]);

  const handleOpenCampModal = (camp = null) => {
    if (camp) {
      setCampForm({ id: camp.id, subject: camp.subject, contentHtml: camp.contentHtml || '', attachments: camp.attachments || [] });
    } else {
      setCampForm({ id: null, subject: '', contentHtml: '', attachments: [] });
    }
    setIsCampModalOpen(true);
  };

  const validateCampaignForm = () => {
    if (!campForm.subject || campForm.subject.trim().length < 3) {
      showMessage('warning', 'Subject Required', 'Please provide a descriptive subject line (min 3 chars).');
      return false;
    }
    const cleanContent = campForm.contentHtml.replace(/<[^>]*>/g, '').trim();
    if (!cleanContent || cleanContent.length < 10) {
      if (!campForm.contentHtml.includes('<img')) {
        showMessage('warning', 'Content Too Short', 'Email content must contain at least some meaningful text.');
        return false;
      }
    }
    return true;
  };

  const handleSaveCampaign = async () => {
    if (!validateCampaignForm()) return;
    setIsSaving(true);
    try {
      // Auto-format plain text to HTML if no markup is found
      let finalHtml = campForm.contentHtml;
      if (finalHtml && !finalHtml.includes('<') && !finalHtml.includes('>')) {
        finalHtml = finalHtml.split(/\n\n+/).map(p => `<p style="margin-bottom:1em;">${p.replace(/\n/g, '<br/>')}</p>`).join('\n');
      }

      const payload = { ...campForm, contentHtml: finalHtml };

      if (campForm.id) {
        await newsletterApi.campaigns.update(campForm.id, payload);
        showMessage('success', 'Campaign Updated', 'Your changes have been saved to the draft.');
      } else {
        const resp = await newsletterApi.campaigns.create(payload);
        setCampForm(prev => ({ ...prev, id: resp.campaign.id }));
        showMessage('success', 'Campaign Created', 'New draft has been successfully initiated.');
      }
      fetchCampaigns();
    } catch (err) {
      showMessage('error', 'Save Failed', err.message || 'The server rejected the campaign payload.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendCampaign = async (id) => {
    // If id is not provided, we are sending the currently open campModal
    const targetId = id || campForm.id;
    if (!targetId) {
      // If no ID yet (new campaign), we must save it first
      await handleSaveCampaign();
      return; 
    }

    // Secondary validation for open modal
    if (!id && !validateCampaignForm()) return;

    if (window.confirm('Are you sure you want to broadcast this to ALL ACTIVE subscribers now?')) {
      setIsSending(true);
      try {
        const res = await newsletterApi.campaigns.send(targetId);
        showMessage('success', 'Broadcast Initiated', `${res.message} Targeted recipients: ${res.targetCount}`);
        setIsCampModalOpen(false);
        fetchCampaigns();
      } catch (err) {
        showMessage('error', 'Broadcast Failed', err.message || 'Unable to queue the campaign for sending.');
      } finally {
        setIsSending(false);
      }
    }
  };

  const handleDeleteCampaign = async (id) => {
    setDeleteConfirmTarget({ id, type: 'campaign' });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingFiles(true);
    try {
      const res = await newsletterApi.campaigns.uploadAttachment(file);
      setCampForm(prev => ({
        ...prev,
        attachments: [...prev.attachments, res]
      }));
    } catch (err) {
      showMessage('error', 'Upload Failed', err.message);
    } finally {
      setUploadingFiles(false);
      e.target.value = '';
    }
  };

  const removeAttachment = (index) => {
    setCampForm(prev => {
      const atts = [...prev.attachments];
      atts.splice(index, 1);
      return { ...prev, attachments: atts };
    });
  };

  return (
    <div className="elite-products-container">
      {/* HEADER */}
      <div className="atelier-header">
        <div className="header-badge">
          <Mail size={14} className="mr-1" />
          COMMUNICATION HUB
        </div>
        <div className="header-main">
          <div className="header-titles">
            <h1 className="atelier-title">Newletter</h1>
            <p className="atelier-subtitle">Manage your audience and send email broadcasts.</p>
          </div>
          <div className="tab-buttons">
            <button 
              className={`btn-tab ${activeTab === 'subscribers' ? 'active' : ''}`}
              onClick={() => setActiveTab('subscribers')}
            >
              <Users size={16} className="mr-1"/> Subscribers
            </button>
            <button 
              className={`btn-tab ${activeTab === 'campaigns' ? 'active' : ''}`}
              onClick={() => setActiveTab('campaigns')}
            >
              <Send size={16} className="mr-1"/> Campaigns
            </button>
          </div>
        </div>
      </div>

      {/* SUBSCRIBERS TAB */}
      {activeTab === 'subscribers' && (
        <div className="tab-pane animate-in">
          <div className="atelier-discovery">
            <div className="search-glass-container">
              <Search className="search-icon" size={18} />
              <input 
                type="text" 
                placeholder="Search email..." 
                className="search-glass-input"
                value={subSearch}
                onChange={(e) => setSubSearch(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '0.65rem', color: 'var(--atelier-text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>START DATE</label>
                <input type="date" title="Start Date" className="search-glass-input" style={{ width: '130px', padding: '10px', fontSize: '0.75rem', height: '42px' }} value={subStartDate} onChange={e => { setSubStartDate(e.target.value); setSubPage(1); }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '0.65rem', color: 'var(--atelier-text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>END DATE</label>
                <input type="date" title="End Date" className="search-glass-input" style={{ width: '130px', padding: '10px', fontSize: '0.75rem', height: '42px' }} value={subEndDate} onChange={e => { setSubEndDate(e.target.value); setSubPage(1); }} />
              </div>
              <div className="select-glass-wrapper" style={{ marginTop: 'auto' }}>
                 <Filter size={16} className="select-icon" />
                 <select 
                   className="select-glass"
                   value={subStatus}
                   onChange={(e) => { setSubStatus(e.target.value); setSubPage(1); }}
                 >
                    <option value="all">ALL STATUSES</option>
                    <option value="active">ACTIVE</option>
                    <option value="unsubscribed">UNSUBSCRIBED</option>
                 </select>
              </div>
              <button onClick={() => setIsSubModalOpen(true)} className="btn-elite-primary" style={{ padding: '10px 20px', marginLeft: '10px' }}>
                <Plus size={16} className="mr-1" /> ADD SUBSCRIBER
              </button>
            </div>
          </div>

          {selectedSubscribers.size > 0 && (
            <div className="elite-glass animate-in" style={{ padding: '12px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--atelier-gold)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--atelier-gold)', fontWeight: 600 }}>{selectedSubscribers.size} Subscriber(s) Selected</span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn-pagination" onClick={() => handleBulkAction('unsubscribe')}>UNSUBSCRIBE SELECTED</button>
                <button className="btn-pagination" style={{ color: 'var(--atelier-error)', borderColor: 'var(--atelier-error)' }} onClick={() => handleBulkAction('delete')}>DELETE SELECTED</button>
              </div>
            </div>
          )}

          <div className="elite-glass" style={{ padding: '20px' }}>
            {subLoading ? (
               <div className="text-center" style={{ padding: '40px', color: 'var(--atelier-gold)' }}>Loading...</div>
            ) : (
              <table className="matrix-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}><input type="checkbox" onChange={handleToggleSelectAll} checked={subscribers.length > 0 && selectedSubscribers.size === subscribers.length} style={{ cursor: 'pointer' }} /></th>
                    <th>EMAIL</th>
                    <th>STATUS</th>
                    <th>SOURCE</th>
                    <th>ADDED DATE</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.length === 0 ? (
                    <tr><td colSpan="5" className="text-center" style={{ padding: '20px' }}>No subscribers found.</td></tr>
                  ) : subscribers.map(s => (
                    <tr key={s.id}>
                      <td><input type="checkbox" checked={selectedSubscribers.has(s.id)} onChange={() => handleToggleSelect(s.id)} style={{ cursor: 'pointer' }} /></td>
                      <td className="price-primary">{s.email}</td>
                      <td>
                        <span className={`badge-status ${s.status === 'active' ? 'active' : 'archived'}`} style={{ display: 'inline-block' }}>
                          {s.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="sku-text">{s.source.toUpperCase()} {s.addedBy && `(${s.addedBy})`}</td>
                      <td className="sku-text">{new Date(s.createdAt).toLocaleDateString()}</td>
                      <td>
                        <button onClick={() => handleToggleSubStatus(s)} className="btn-mini-action" title="Toggle Status">
                          <RefreshCw size={14} />
                        </button>
                        <button onClick={() => setDeleteConfirmTarget({ id: s.id, type: 'subscriber' })} className="btn-mini-action danger" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="atelier-pagination" style={{ marginTop: '20px', borderTop: '1px solid var(--atelier-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '24px', borderRadius: '20px' }}>
              <div className="pagination-info" style={{ fontSize: '0.85rem', color: 'var(--atelier-text-muted)', fontFamily: 'var(--atelier-font-header)' }}>
                Showing {subscribers.length} of {subTotal} Subscribers
              </div>
              <div className="pagination-controls" style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                <button className="btn-pagination" disabled={subPage <= 1} onClick={() => setSubPage(subPage - 1)}>PREVIOUS</button>
                <div className="page-summary" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--atelier-gold)', letterSpacing: '0.1em' }}>PAGE {subPage} OF {subTotalPages || 1}</div>
                <button className="btn-pagination" disabled={subPage >= subTotalPages} onClick={() => setSubPage(subPage + 1)}>NEXT</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CAMPAIGNS TAB */}
      {activeTab === 'campaigns' && (
        <div className="tab-pane animate-in">
          <div className="atelier-discovery">
            <div className="filter-group">
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '0.65rem', color: 'var(--atelier-text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>START DATE</label>
                <input type="date" title="Start Date" className="search-glass-input" style={{ width: '130px', padding: '10px', fontSize: '0.75rem', height: '42px' }} value={campStartDate} onChange={e => { setCampStartDate(e.target.value); setCampPage(1); }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '0.65rem', color: 'var(--atelier-text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>END DATE</label>
                <input type="date" title="End Date" className="search-glass-input" style={{ width: '130px', padding: '10px', fontSize: '0.75rem', height: '42px' }} value={campEndDate} onChange={e => { setCampEndDate(e.target.value); setCampPage(1); }} />
              </div>
            </div>
            <button onClick={() => handleOpenCampModal()} className="btn-elite-primary" style={{ padding: '10px 20px' }}>
              <Plus size={16} className="mr-1" /> COMPOSE NEW CAMPAIGN
            </button>
          </div>

          <div className="atelier-grid">
             {campLoading ? (
               <div style={{ color: 'var(--atelier-gold)' }}>Loading campaigns...</div>
             ) : campaigns.length === 0 ? (
               <div style={{ padding: '40px', color: 'var(--atelier-text-muted)' }}>No campaigns drafted yet.</div>
             ) : campaigns.map(c => (
               <div key={c.id} className="atelier-card elite-glass" style={{ padding: '24px' }}>
                 <div className="card-top" style={{ padding: 0, border: 'none', marginBottom: '16px' }}>
                   <div>
                     <span className={`badge-status ${c.status === 'sent' ? 'active' : 'archived'}`} style={{ display: 'inline-flex', marginBottom: '8px' }}>
                       {c.status.toUpperCase()}
                     </span>
                     <h3 className="product-name" style={{ fontSize: '1.4rem' }}>{c.subject}</h3>
                   </div>
                   <div className="card-actions">
                     {c.status !== 'sent' && (
                       <>
                         <button onClick={() => handleOpenCampModal(c)} className="btn-mini-action"><Edit2 size={14}/></button>
                         <button onClick={() => handleDeleteCampaign(c.id)} className="btn-mini-action danger"><Trash2 size={14}/></button>
                       </>
                     )}
                   </div>
                 </div>
                 
                 <div className="sidebar-meta" style={{ marginBottom: '20px' }}>
                    <div className="meta-item"><span className="label">Sent Count:</span> <span className="value">{c.sentCount}</span></div>
                    {c.sentAt && <div className="meta-item"><span className="label">Sent At:</span> <span className="value">{new Date(c.sentAt).toLocaleString()}</span></div>}
                 </div>

                 {c.status !== 'sent' && c.status !== 'sending' && (
                   <button onClick={() => handleSendCampaign(c.id)} className="btn-elite-primary" style={{ width: '100%', justifyContent: 'center' }}>
                     <Send size={16} /> BROADCAST NOW
                   </button>
                 )}
               </div>
             ))}
           </div>
           
          <div className="atelier-pagination" style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <div className="pagination-info" style={{ color: 'var(--atelier-text-muted)', fontSize: '0.85rem' }}>Total: {campTotal} | Page {campPage} of {campTotalPages || 1}</div>
             <div style={{ display: 'flex', gap: '10px' }}>
               <button className="btn-pagination" disabled={campPage <= 1} onClick={() => setCampPage(campPage - 1)}>PREVIOUS</button>
               <button className="btn-pagination" disabled={campPage >= campTotalPages} onClick={() => setCampPage(campPage + 1)}>NEXT</button>
             </div>
          </div>
        </div>
      )}

      {/* SUBSCRIBER MODAL */}
      {isSubModalOpen && (
        <div className="modal-overlay" onClick={() => setIsSubModalOpen(false)}>
          <div className="modal-content elite-glass" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h2 className="atelier-title" style={{ fontSize: '1.8rem', marginBottom: '20px' }}>Add Subscriber</h2>
            <form onSubmit={handleAddSubscriber}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ display:'block', marginBottom:'8px', color:'var(--atelier-text-muted)', fontSize:'0.8rem' }}>EMAIL ADDRESS</label>
                <input 
                  type="email" 
                  required 
                  className="search-glass-input" 
                  style={{ paddingLeft: '16px' }}
                  value={newSubEmail} 
                  onChange={e => setNewSubEmail(e.target.value)} 
                />
              </div>
              {subError && (
                <div style={{ padding: '12px', background: 'rgba(192,57,43,0.1)', color: 'var(--atelier-error)', borderLeft: '3px solid var(--atelier-error)', marginBottom: '20px', borderRadius: '4px', fontSize: '0.85rem' }}>
                  {subError}
                </div>
              )}
              <div className="modal-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-pagination" onClick={() => setIsSubModalOpen(false)}>CANCEL</button>
                <button type="submit" className="btn-elite-primary">ADD SUBSCRIBER</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CAMPAIGN MODAL */}
      {isCampModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 999 }} onClick={() => setIsCampModalOpen(false)}>
          <div className="modal-content elite-glass" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 className="atelier-title" style={{ fontSize: '2rem', marginBottom: '24px' }}>
              {campForm.id ? 'Edit Campaign' : 'Compose Newsletters'}
            </h2>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label style={{ display:'block', marginBottom:'8px', color:'var(--atelier-text-muted)', fontSize:'0.8rem' }}>SUBJECT LINE</label>
              <input 
                type="text" 
                className="search-glass-input" 
                style={{ paddingLeft: '16px' }}
                value={campForm.subject} 
                onChange={e => setCampForm({...campForm, subject: e.target.value})} 
                placeholder="e.g. The Spring Collection is Here"
              />
            </div>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label style={{ display:'block', marginBottom:'8px', color:'var(--atelier-text-muted)', fontSize:'0.8rem' }}>EMAIL CONTENT (RICH TEXT)</label>
              <div style={{ background: 'var(--color-bg-card)', borderRadius: '8px', overflow: 'hidden', minHeight: '340px' }} className="quill-container-override">
                {!editorReady && (
                  <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text)' }}>
                     <RefreshCw className="spinner" size={24} />
                     <span style={{ marginLeft: '10px' }}>Loading Designer Studio...</span>
                  </div>
                )}
                <div 
                  ref={quillRef} 
                  style={{ 
                    display: editorReady ? 'block' : 'none',
                    height: '300px',
                    color: 'var(--color-text)'
                  }} 
                />
              </div>
              <p style={{ fontSize: '0.7rem', color: 'var(--atelier-gold)', marginTop: '12px' }}>
                * Click the image icon inside the toolbar above to embed images directly into the text layout. Attachments can still be appended silently below.
              </p>
            </div>
            <div className="form-group" style={{ marginBottom: '30px' }}>
              <label style={{ display:'block', marginBottom:'8px', color:'var(--atelier-text-muted)', fontSize:'0.8rem' }}>ATTACHMENTS</label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                {campForm.attachments.map((att, i) => (
                  <div key={i} className="atelier-tag" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Paperclip size={12}/> 
                    <span style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace:'nowrap' }}>{att.filename}</span>
                    <XCircle size={12} style={{ cursor: 'pointer', color: 'var(--atelier-error)' }} onClick={() => removeAttachment(i)} />
                  </div>
                ))}
              </div>
              <label className="btn-pagination" style={{ display: 'inline-flex', cursor: 'pointer' }}>
                {uploadingFiles ? 'UPLOADING...' : 'ADD ATTACHMENT'}
                <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploadingFiles} />
              </label>
            </div>
            
            <div className="modal-actions" style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', borderTop: '1px solid rgba(184,155,106,0.2)', paddingTop: '24px' }}>
              <button type="button" className="btn-pagination" onClick={() => setIsCampModalOpen(false)}>CLOSE</button>
              <button type="button" className="btn-pagination" style={{ color: 'var(--atelier-gold)' }} onClick={handleSaveCampaign} disabled={isSaving || isSending}>
                {isSaving ? 'SAVING...' : 'SAVE DRAFT'}
              </button>
              <button type="button" className="btn-elite-primary" onClick={() => handleSendCampaign()} disabled={isSaving || isSending}>
                {isSending ? 'SENDING...' : 'SEND CAMPAIGN'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {deleteConfirmTarget && (
        <div className="modal-overlay" style={{ zIndex: 1001 }} onClick={() => setDeleteConfirmTarget(null)}>
          <div className="modal-content elite-glass animate-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <Trash2 size={40} color="var(--atelier-error)" style={{ margin: '0 auto 20px auto' }} />
            <h2 className="atelier-title" style={{ fontSize: '1.6rem', marginBottom: '10px' }}>Are you sure?</h2>
            <p style={{ color: 'var(--atelier-text-muted)', fontSize: '0.9rem', marginBottom: '30px' }}>
              This action cannot be undone. This {deleteConfirmTarget.type} will be permanently deleted from the database.
            </p>
            <div className="modal-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button type="button" className="btn-pagination" onClick={() => setDeleteConfirmTarget(null)}>CANCEL</button>
              <button type="button" className="btn-elite-primary" style={{ background: 'var(--atelier-error)' }} onClick={confirmDelete}>YES, DELETE IT</button>
            </div>
          </div>
        </div>
      )}

      {/* STYLES (inheriting mostly from Products.jsx container scope, adding specific overrides here) */}
      <style dangerouslySetInnerHTML={{ __html: `
        .elite-products-container {
          padding: 40px;
          min-height: 100vh;
          background: var(--color-bg-dark);
          color: var(--color-text);
          font-family: var(--atelier-font-body);
        }

        .atelier-header { margin-bottom: 40px; }
        .header-badge {
          display: inline-flex; align-items: center;
          padding: 6px 14px; border-radius: 40px;
          background: var(--color-border-light); border: 1px solid var(--color-border);
          color: var(--color-primary); font-size: 0.65rem; font-weight: 700;
          letter-spacing: 0.2em; margin-bottom: 16px;
        }
        .header-main { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; }
        .atelier-title { 
          font-family: var(--atelier-font-header); font-size: 2.8rem; font-weight: 300;
          letter-spacing: -0.02em; line-height: 1.1; margin: 0;
        }
        .atelier-subtitle { color: var(--color-text-muted); font-size: 1rem; margin-top: 10px; max-width: 500px; }
        
        .tab-buttons { display: flex; gap: 10px; }
        .btn-tab {
          background: rgba(255,255,255,0.02); color: var(--atelier-text-muted);
          border: 1px solid var(--atelier-border); border-radius: 8px; padding: 12px 24px;
          display: flex; align-items: center; font-family: var(--atelier-font-header);
          font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.3s;
        }
        .btn-tab.active {
          background: var(--color-border-light); color: var(--color-primary); border-color: var(--color-primary);
        }
        .btn-tab:hover:not(.active) { background: rgba(255,255,255,0.05); }

        .btn-elite-primary {
          background: var(--color-primary); color: #000;
          border: none; border-radius: 8px; padding: 14px 28px;
          display: flex; align-items: center; gap: 12px;
          font-family: var(--atelier-font-header); font-size: 0.85rem; font-weight: 600;
          letter-spacing: 0.1em; cursor: pointer; transition: all 0.4s cubic-bezier(0.19, 1, 0.22, 1);
        }
        .btn-elite-primary:hover { transform: translateY(-3px); box-shadow: 0 15px 40px rgba(184,155,106,0.25); filter: brightness(1.1); }

        .atelier-discovery { 
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 24px; animation: slideIn 0.8s cubic-bezier(0.19, 1, 0.22, 1);
        }
        .search-glass-container { flex: 1; max-width: 400px; position: relative; display: flex; align-items: center; }
        .search-icon { position: absolute; left: 20px; color: var(--color-primary); opacity: 0.6; }
        .search-glass-input {
          width: 100%; padding: 14px 20px 14px 54px;
          background: var(--color-bg-card); border: 1.5px solid var(--color-border);
          border-radius: 12px; color: var(--color-text); font-size: 0.9rem;
          transition: all 0.3s; backdrop-filter: blur(10px);
        }
        .search-glass-input:focus { border-color: var(--color-primary); outline: none; }
        
        .filter-group { display: flex; gap: 12px; }
        .select-glass-wrapper { position: relative; display: flex; align-items: center; }
        .select-icon { position: absolute; left: 16px; color: var(--color-primary); pointer-events: none; opacity: 0.7; }
        .select-glass {
          background: var(--color-bg-card); border: 1.5px solid var(--color-border);
          border-radius: 12px; color: var(--color-text); padding: 14px 20px 14px 44px;
          font-size: 0.75rem; letter-spacing: 0.1em; cursor: pointer; text-transform: uppercase;
        }

        .elite-glass {
          background: var(--glass-bg); border: 1.5px solid var(--color-border);
          border-radius: 20px; backdrop-filter: blur(12px);
        }

        .matrix-table { width: 100%; border-collapse: collapse; text-align: left; }
        .matrix-table th { padding: 16px; font-size: 0.65rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid var(--color-border); }
        .matrix-table td { padding: 16px; font-size: 0.85rem; border-bottom: 1px solid var(--color-border-light); }

        .badge-status { 
          display: flex; align-items: center; gap: 6px; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.1em;
          padding: 6px 12px; border-radius: 4px;
        }
        .badge-status.active { color: var(--atelier-success); background: rgba(39, 174, 96, 0.1); border: 1px solid rgba(39, 174, 96, 0.3); }
        .badge-status.archived { color: var(--atelier-text-muted); background: rgba(255,255,255,0.05); }

        .btn-mini-action {
          width: 32px; height: 32px; border: 1px solid var(--atelier-border);
          border-radius: 8px; background: transparent; color: var(--atelier-text-muted);
          display: inline-flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.3s; margin-right: 8px;
        }
        .btn-mini-action:hover { border-color: var(--color-primary); color: var(--color-primary); background: var(--color-border-light); }
        .btn-mini-action.danger:hover { border-color: var(--color-error-text); color: var(--color-error-text); background: rgba(192,57,43,0.1); }

        .atelier-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 24px; }
        .card-top { display: flex; justify-content: space-between; align-items: flex-start; }

        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(5px);
          display: flex; align-items: center; justify-content: center; z-index: 1000;
        }
        .modal-content { padding: 40px; }
        
        .btn-pagination {
          background: transparent; border: 1px solid var(--atelier-border);
          color: var(--atelier-text); padding: 10px 20px; border-radius: 8px;
          font-size: 0.75rem; font-weight: 600; letter-spacing: 0.15em;
          cursor: pointer; transition: all 0.3s;
        }
        .btn-pagination:hover { border-color: var(--atelier-gold); color: var(--atelier-gold); }

        .animate-in { animation: cardIn 0.4s cubic-bezier(0.19, 1, 0.22, 1) forwards; opacity: 0; transform: translateY(10px); }
        @keyframes cardIn { to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }

        @media (max-width: 768px) {
          .elite-products-container { padding: 20px; }
          .header-main { flex-direction: column; align-items: stretch; }
          .atelier-title { font-size: 2rem; }
          .atelier-discovery { flex-direction: column; align-items: stretch; }
          .search-glass-container { max-width: none; }
          .tab-buttons { flex-wrap: wrap; }
          .atelier-grid { grid-template-columns: 1fr; }
          .modal-content { padding: 24px; }
        }
      `}} />
    </div>
  );
}
