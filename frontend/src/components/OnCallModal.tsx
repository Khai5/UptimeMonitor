import { useState, useEffect } from 'react';
import { FaTimes, FaUserClock, FaPlus, FaEdit, FaTrash, FaPhone, FaEnvelope, FaUser } from 'react-icons/fa';
import { OnCallContact, OnCallSchedule, OnCallRecurrence } from '../types';
import { adminApi } from '../api';

interface OnCallModalProps {
  password: string;
  onClose: () => void;
}

type Tab = 'contacts' | 'schedules';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function recurrenceLabel(r: OnCallRecurrence): string {
  if (r === 'daily') return 'Daily';
  if (r === 'weekly') return 'Weekly';
  return 'One-time';
}

export default function OnCallModal({ password, onClose }: OnCallModalProps) {
  const [tab, setTab] = useState<Tab>('contacts');
  const [contacts, setContacts] = useState<OnCallContact[]>([]);
  const [schedules, setSchedules] = useState<OnCallSchedule[]>([]);
  const [currentOnCall, setCurrentOnCall] = useState<OnCallSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Contact form state
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState<OnCallContact | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactSaving, setContactSaving] = useState(false);

  // Schedule form state
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<OnCallSchedule | null>(null);
  const [scheduleContactId, setScheduleContactId] = useState<number | ''>('');
  const [scheduleName, setScheduleName] = useState('');
  const [scheduleStart, setScheduleStart] = useState('');
  const [scheduleEnd, setScheduleEnd] = useState('');
  const [scheduleRecurrence, setScheduleRecurrence] = useState<OnCallRecurrence>('none');
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const fetchAll = async () => {
    try {
      const [contactsRes, schedulesRes, currentRes] = await Promise.all([
        adminApi.getOnCallContacts(password),
        adminApi.getOnCallSchedules(password),
        adminApi.getCurrentOnCall(password),
      ]);
      setContacts(contactsRes.data);
      setSchedules(schedulesRes.data);
      setCurrentOnCall(currentRes.data.current);
    } catch (err) {
      setError('Failed to load on-call data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // ── Contact CRUD ──────────────────────────────────────────────────────────

  const openAddContact = () => {
    setEditingContact(null);
    setContactName('');
    setContactEmail('');
    setContactPhone('');
    setShowContactForm(true);
  };

  const openEditContact = (c: OnCallContact) => {
    setEditingContact(c);
    setContactName(c.name);
    setContactEmail(c.email);
    setContactPhone(c.phone || '');
    setShowContactForm(true);
  };

  const saveContact = async () => {
    if (!contactName.trim() || !contactEmail.trim()) return;
    setContactSaving(true);
    try {
      if (editingContact) {
        await adminApi.updateOnCallContact(password, editingContact.id, {
          name: contactName.trim(),
          email: contactEmail.trim(),
          phone: contactPhone.trim() || undefined,
        });
      } else {
        await adminApi.createOnCallContact(password, {
          name: contactName.trim(),
          email: contactEmail.trim(),
          phone: contactPhone.trim() || undefined,
        });
      }
      setShowContactForm(false);
      await fetchAll();
    } catch {
      alert('Failed to save contact');
    } finally {
      setContactSaving(false);
    }
  };

  const deleteContact = async (id: number) => {
    if (!confirm('Delete this contact? Their schedules will also be removed.')) return;
    try {
      await adminApi.deleteOnCallContact(password, id);
      await fetchAll();
    } catch {
      alert('Failed to delete contact');
    }
  };

  // ── Schedule CRUD ─────────────────────────────────────────────────────────

  const openAddSchedule = () => {
    setEditingSchedule(null);
    setScheduleContactId('');
    setScheduleName('');
    setScheduleStart('');
    setScheduleEnd('');
    setScheduleRecurrence('none');
    setShowScheduleForm(true);
  };

  const openEditSchedule = (s: OnCallSchedule) => {
    setEditingSchedule(s);
    setScheduleContactId(s.contact_id);
    setScheduleName(s.name);
    // Convert ISO to datetime-local format (YYYY-MM-DDTHH:MM)
    setScheduleStart(s.start_time.slice(0, 16));
    setScheduleEnd(s.end_time.slice(0, 16));
    setScheduleRecurrence(s.recurrence);
    setShowScheduleForm(true);
  };

  const saveSchedule = async () => {
    if (!scheduleContactId || !scheduleName.trim() || !scheduleStart || !scheduleEnd) return;
    setScheduleSaving(true);
    try {
      const payload = {
        contact_id: Number(scheduleContactId),
        name: scheduleName.trim(),
        start_time: new Date(scheduleStart).toISOString(),
        end_time: new Date(scheduleEnd).toISOString(),
        recurrence: scheduleRecurrence,
      };
      if (editingSchedule) {
        await adminApi.updateOnCallSchedule(password, editingSchedule.id, payload);
      } else {
        await adminApi.createOnCallSchedule(password, payload);
      }
      setShowScheduleForm(false);
      await fetchAll();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to save schedule');
    } finally {
      setScheduleSaving(false);
    }
  };

  const deleteSchedule = async (id: number) => {
    if (!confirm('Delete this on-call schedule?')) return;
    try {
      await adminApi.deleteOnCallSchedule(password, id);
      await fetchAll();
    } catch {
      alert('Failed to delete schedule');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <FaUserClock className="text-purple-600 text-xl" />
            <h2 className="text-xl font-semibold text-gray-900">On-Call Management</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <FaTimes className="text-xl" />
          </button>
        </div>

        {/* Current on-call banner */}
        <div className={`px-6 py-3 text-sm font-medium ${currentOnCall ? 'bg-purple-50 text-purple-800' : 'bg-gray-50 text-gray-500'}`}>
          {loading ? 'Loading…' : currentOnCall ? (
            <span>
              Currently on-call: <strong>{currentOnCall.contact_name}</strong> ({currentOnCall.contact_email})
              {' '}&mdash; <em>{currentOnCall.name}</em>
            </span>
          ) : (
            'No one is currently on-call.'
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          {(['contacts', 'schedules'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t === 'contacts' ? 'Contacts' : 'Schedules'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && <div className="text-red-600 text-sm mb-3">{error}</div>}

          {/* ── CONTACTS TAB ── */}
          {tab === 'contacts' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-600">People who can be assigned to on-call shifts.</p>
                <button
                  onClick={openAddContact}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 transition-colors"
                >
                  <FaPlus className="text-xs" /><span>Add Contact</span>
                </button>
              </div>

              {/* Contact form */}
              {showContactForm && (
                <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-800 mb-3">{editingContact ? 'Edit Contact' : 'New Contact'}</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                      <input
                        type="text"
                        value={contactName}
                        onChange={e => setContactName(e.target.value)}
                        placeholder="Jane Smith"
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                      <input
                        type="email"
                        value={contactEmail}
                        onChange={e => setContactEmail(e.target.value)}
                        placeholder="jane@example.com"
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Phone (optional)</label>
                      <input
                        type="tel"
                        value={contactPhone}
                        onChange={e => setContactPhone(e.target.value)}
                        placeholder="+1 555 123 4567"
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2 mt-4">
                    <button
                      onClick={() => setShowContactForm(false)}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                    >Cancel</button>
                    <button
                      onClick={saveContact}
                      disabled={contactSaving || !contactName.trim() || !contactEmail.trim()}
                      className="px-4 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors"
                    >{contactSaving ? 'Saving…' : 'Save'}</button>
                  </div>
                </div>
              )}

              {/* Contact list */}
              {contacts.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No contacts yet. Add one to get started.
                </div>
              ) : (
                <div className="space-y-2">
                  {contacts.map(c => (
                    <div key={c.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3">
                      <div>
                        <div className="flex items-center space-x-2 font-medium text-gray-900">
                          <FaUser className="text-gray-400 text-xs" />
                          <span>{c.name}</span>
                        </div>
                        <div className="flex items-center space-x-3 mt-1 text-sm text-gray-500">
                          <span className="flex items-center space-x-1"><FaEnvelope className="text-xs" /><span>{c.email}</span></span>
                          {c.phone && <span className="flex items-center space-x-1"><FaPhone className="text-xs" /><span>{c.phone}</span></span>}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button onClick={() => openEditContact(c)} className="text-gray-400 hover:text-blue-600 transition-colors" title="Edit">
                          <FaEdit />
                        </button>
                        <button onClick={() => deleteContact(c.id)} className="text-gray-400 hover:text-red-600 transition-colors" title="Delete">
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── SCHEDULES TAB ── */}
          {tab === 'schedules' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-600">Define when each contact is on-call.</p>
                <button
                  onClick={openAddSchedule}
                  disabled={contacts.length === 0}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  title={contacts.length === 0 ? 'Add a contact first' : ''}
                >
                  <FaPlus className="text-xs" /><span>Add Schedule</span>
                </button>
              </div>

              {contacts.length === 0 && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  Add a contact in the Contacts tab before creating a schedule.
                </div>
              )}

              {/* Schedule form */}
              {showScheduleForm && (
                <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-800 mb-3">{editingSchedule ? 'Edit Schedule' : 'New Schedule'}</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Schedule Name *</label>
                      <input
                        type="text"
                        value={scheduleName}
                        onChange={e => setScheduleName(e.target.value)}
                        placeholder="Primary On-Call Week 1"
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Contact *</label>
                      <select
                        value={scheduleContactId}
                        onChange={e => setScheduleContactId(Number(e.target.value))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="">Select a contact…</option>
                        {contacts.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Start *</label>
                        <input
                          type="datetime-local"
                          value={scheduleStart}
                          onChange={e => setScheduleStart(e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">End *</label>
                        <input
                          type="datetime-local"
                          value={scheduleEnd}
                          onChange={e => setScheduleEnd(e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Recurrence</label>
                      <select
                        value={scheduleRecurrence}
                        onChange={e => setScheduleRecurrence(e.target.value as OnCallRecurrence)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="none">One-time (no repeat)</option>
                        <option value="daily">Daily (repeats every day at the same time)</option>
                        <option value="weekly">Weekly (repeats every week on the same days)</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2 mt-4">
                    <button onClick={() => setShowScheduleForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                    <button
                      onClick={saveSchedule}
                      disabled={scheduleSaving || !scheduleContactId || !scheduleName.trim() || !scheduleStart || !scheduleEnd}
                      className="px-4 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors"
                    >{scheduleSaving ? 'Saving…' : 'Save'}</button>
                  </div>
                </div>
              )}

              {/* Schedule list */}
              {schedules.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No schedules yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {schedules.map(s => {
                    const isActive = currentOnCall?.id === s.id;
                    return (
                      <div key={s.id} className={`flex items-start justify-between border rounded-lg px-4 py-3 ${isActive ? 'bg-purple-50 border-purple-300' : 'bg-white border-gray-200'}`}>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900 truncate">{s.name}</span>
                            {isActive && (
                              <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full">Active</span>
                            )}
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{recurrenceLabel(s.recurrence)}</span>
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            <FaUser className="inline text-xs mr-1" />{s.contact_name}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {formatDateTime(s.start_time)} – {formatDateTime(s.end_time)}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
                          <button onClick={() => openEditSchedule(s)} className="text-gray-400 hover:text-blue-600 transition-colors" title="Edit">
                            <FaEdit />
                          </button>
                          <button onClick={() => deleteSchedule(s.id)} className="text-gray-400 hover:text-red-600 transition-colors" title="Delete">
                            <FaTrash />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
