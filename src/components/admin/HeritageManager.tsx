import React, { useCallback, useEffect, useState } from 'react';
import { Camera, Check, ImageUp, MapPin, Plus, Save, Trash2 } from 'lucide-react';

type HeritageData = { locations: any[]; viewpoints: any[]; hotspots: any[] };
const jsonRequest = async (url: string, method = 'GET', body?: unknown) => {
  const response = await fetch(url, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.message || `Request failed (${response.status}).`);
  return result.data;
};

export const HeritageManager: React.FC = () => {
  const [data, setData] = useState<HeritageData>({ locations: [], viewpoints: [], hotspots: [] });
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedViewpointId, setSelectedViewpointId] = useState('');
  const [selectedHotspotId, setSelectedHotspotId] = useState('');
  const [locationForm, setLocationForm] = useState({ title: '', description: '', city: '', state: '', country: 'India' });
  const [viewpointForm, setViewpointForm] = useState({ title: '', description: '', initialHeading: 0, initialPitch: 0, initialZoom: 1 });
  const [hotspotForm, setHotspotForm] = useState({ title: '', description: '', heading: 0, pitch: 0, targetType: 'none', targetId: '', targetViewpointId: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try { const next = await jsonRequest('/api/heritage/admin/locations'); setData(next); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Heritage data could not be loaded.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const locations = data.locations || [];
  const viewpoints = data.viewpoints.filter(viewpoint => viewpoint.heritage_location_id === selectedLocationId);
  const selectedLocation = locations.find(location => location.id === selectedLocationId);
  const selectedViewpoint = viewpoints.find(viewpoint => viewpoint.id === selectedViewpointId);
  const hotspots = data.hotspots.filter(hotspot => hotspot.viewpoint_id === selectedViewpointId);

  const run = async (action: () => Promise<void>) => {
    setLoading(true); setError(''); setNotice('');
    try { await action(); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Heritage operation failed.'); }
    finally { setLoading(false); }
  };

  const saveLocation = () => run(async () => {
    if (selectedLocationId) await jsonRequest(`/api/heritage/admin/locations/${encodeURIComponent(selectedLocationId)}`, 'PATCH', locationForm);
    else {
      const created = await jsonRequest('/api/heritage/admin/locations', 'POST', locationForm);
      setSelectedLocationId(created.id);
    }
    setNotice('Location saved as draft.');
  });

  const saveViewpoint = () => run(async () => {
    if (selectedViewpointId) await jsonRequest(`/api/heritage/admin/viewpoints/${encodeURIComponent(selectedViewpointId)}`, 'PATCH', viewpointForm);
    else {
      const created = await jsonRequest(`/api/heritage/admin/locations/${encodeURIComponent(selectedLocationId)}/viewpoints`, 'POST', viewpointForm);
      setSelectedViewpointId(created.id);
    }
    setNotice('Viewpoint saved. It remains unpublished until a valid panorama is uploaded.');
  });

  const uploadPanorama = (file?: File) => {
    if (!file || !selectedViewpointId) return;
    void run(async () => {
      const form = new FormData(); form.append('file', file);
      const response = await fetch(`/api/heritage/admin/viewpoints/${encodeURIComponent(selectedViewpointId)}/panorama`, { method: 'POST', credentials: 'same-origin', body: form });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.message || 'Panorama upload failed.');
      setNotice(`Image decoded and stored as a ${result.data.width} Ã— ${result.data.height} panorama. Review before publishing.`);
    });
  };

  const saveHotspot = () => run(async () => {
    const body = { ...hotspotForm, targetId: hotspotForm.targetId || null, targetViewpointId: hotspotForm.targetViewpointId || null };
    const url = selectedHotspotId ? `/api/heritage/admin/hotspots/${encodeURIComponent(selectedHotspotId)}` : `/api/heritage/admin/viewpoints/${encodeURIComponent(selectedViewpointId)}/hotspots`;
    await jsonRequest(url, selectedHotspotId ? 'PATCH' : 'POST', body);
    setSelectedHotspotId(''); setHotspotForm({ title: '', description: '', heading: 0, pitch: 0, targetType: 'none', targetId: '', targetViewpointId: '' });
    setNotice('Hotspot saved from database-backed position and target data.');
  });

  const setLocation = (locationId: string) => {
    setSelectedLocationId(locationId); setSelectedViewpointId(''); setSelectedHotspotId('');
    const item = locations.find(location => location.id === locationId);
    setLocationForm(item ? { title: item.title, description: item.description || '', city: item.city || '', state: item.state || '', country: item.country || '' } : { title: '', description: '', city: '', state: '', country: 'India' });
  };
  const setViewpoint = (viewpointId: string) => {
    setSelectedViewpointId(viewpointId); setSelectedHotspotId('');
    const item = viewpoints.find(viewpoint => viewpoint.id === viewpointId);
    setViewpointForm(item ? { title: item.title, description: item.description || '', initialHeading: Number(item.initial_heading), initialPitch: Number(item.initial_pitch), initialZoom: Number(item.initial_zoom) } : { title: '', description: '', initialHeading: 0, initialPitch: 0, initialZoom: 1 });
  };

  return <div className="space-y-6">
    <div className="rounded-xl border border-stone-300 bg-white p-5 shadow-xs">
      <div className="flex items-center gap-3"><Camera className="h-5 w-5 text-amber-700" /><div><h2 className="font-serif text-lg font-bold text-stone-900">360Â° Heritage Viewer management</h2><p className="text-xs text-stone-600">Only verified uploaded equirectangular panoramas can be published. No sample locations or scenes are included.</p></div></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-stone-700">Heritage location<select value={selectedLocationId} onChange={event => setLocation(event.target.value)} className="mt-1 block w-full rounded-lg border border-stone-300 bg-white p-2"><option value="">Create a locationâ€¦</option>{locations.map(location => <option key={location.id} value={location.id}>{location.title} Â· {location.status}</option>)}</select></label>
        <div className="text-xs text-stone-600">{locations.length} database location(s) Â· {viewpoints.length} viewpoint(s) for this location</div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input aria-label="Location title" placeholder="Location title" value={locationForm.title} onChange={event => setLocationForm({ ...locationForm, title: event.target.value })} className="rounded-lg border border-stone-300 p-2 text-sm" />
        <input aria-label="City" placeholder="City" value={locationForm.city} onChange={event => setLocationForm({ ...locationForm, city: event.target.value })} className="rounded-lg border border-stone-300 p-2 text-sm" />
        <input aria-label="State" placeholder="State" value={locationForm.state} onChange={event => setLocationForm({ ...locationForm, state: event.target.value })} className="rounded-lg border border-stone-300 p-2 text-sm" />
        <input aria-label="Country" placeholder="Country" value={locationForm.country} onChange={event => setLocationForm({ ...locationForm, country: event.target.value })} className="rounded-lg border border-stone-300 p-2 text-sm" />
        <textarea aria-label="Location description" placeholder="Verified location description" value={locationForm.description} onChange={event => setLocationForm({ ...locationForm, description: event.target.value })} className="min-h-20 rounded-lg border border-stone-300 p-2 text-sm sm:col-span-2" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2"><button disabled={loading} onClick={() => void saveLocation()} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-stone-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" />{selectedLocationId ? 'Save location' : 'Create draft location'}</button>{selectedLocation && <button disabled={loading} onClick={() => void run(async () => { const next = selectedLocation.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'; await jsonRequest(`/api/heritage/admin/locations/${selectedLocationId}`, 'PATCH', { status: next }); setNotice(`Location ${next.toLowerCase()}.`); })} className="min-h-10 rounded-lg border border-stone-300 px-3 py-2 text-xs font-semibold">{selectedLocation.status === 'PUBLISHED' ? 'Unpublish location' : 'Publish location'}</button>}</div>
    </div>

    {selectedLocationId && <div className="rounded-xl border border-stone-300 bg-white p-5 shadow-xs">
      <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-amber-700" /><h3 className="font-serif text-lg font-bold text-stone-900">Viewpoints</h3></div>
      <select value={selectedViewpointId} onChange={event => setViewpoint(event.target.value)} className="mt-3 w-full rounded-lg border border-stone-300 bg-white p-2 text-sm"><option value="">Add viewpointâ€¦</option>{viewpoints.map(viewpoint => <option key={viewpoint.id} value={viewpoint.id}>{viewpoint.title} Â· {viewpoint.status}{viewpoint.has_panorama ? ' Â· panorama ready' : ' Â· no panorama'}</option>)}</select>
      <div className="mt-3 grid gap-3 sm:grid-cols-2"><input placeholder="Viewpoint title" aria-label="Viewpoint title" value={viewpointForm.title} onChange={event => setViewpointForm({ ...viewpointForm, title: event.target.value })} className="rounded-lg border border-stone-300 p-2 text-sm" /><input placeholder="Description" aria-label="Viewpoint description" value={viewpointForm.description} onChange={event => setViewpointForm({ ...viewpointForm, description: event.target.value })} className="rounded-lg border border-stone-300 p-2 text-sm" />
        <label className="text-xs text-stone-700">Initial heading<input type="number" min="-360" max="360" value={viewpointForm.initialHeading} onChange={event => setViewpointForm({ ...viewpointForm, initialHeading: Number(event.target.value) })} className="mt-1 block w-full rounded-lg border border-stone-300 p-2" /></label>
        <label className="text-xs text-stone-700">Initial pitch<input type="number" min="-90" max="90" value={viewpointForm.initialPitch} onChange={event => setViewpointForm({ ...viewpointForm, initialPitch: Number(event.target.value) })} className="mt-1 block w-full rounded-lg border border-stone-300 p-2" /></label>
        <label className="text-xs text-stone-700">Initial zoom<input type="number" min="1" max="3" step="0.1" value={viewpointForm.initialZoom} onChange={event => setViewpointForm({ ...viewpointForm, initialZoom: Number(event.target.value) })} className="mt-1 block w-full rounded-lg border border-stone-300 p-2" /></label>
        <button disabled={loading} onClick={() => void saveViewpoint()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-stone-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" />{selectedViewpointId ? 'Save viewpoint settings' : 'Add viewpoint'}</button>
      </div>
      {selectedViewpointId && <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-stone-50 p-3">
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold"><ImageUp className="h-4 w-4" />Upload 360 panorama<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={event => uploadPanorama(event.target.files?.[0])} /></label>
        <span className="text-xs text-stone-600">{selectedViewpoint?.has_panorama ? `${selectedViewpoint.panorama_width}Ã—${selectedViewpoint.panorama_height} Â· ${selectedViewpoint.status}` : 'No actual panorama asset uploaded.'}</span>
        {selectedViewpoint?.has_panorama && <button disabled={loading} onClick={() => void run(async () => { const next = selectedViewpoint.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'; await jsonRequest(`/api/heritage/admin/viewpoints/${selectedViewpointId}`, 'PATCH', { status: next }); setNotice(`Viewpoint ${next.toLowerCase()}.`); })} className="min-h-10 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold">{selectedViewpoint.status === 'PUBLISHED' ? 'Unpublish viewpoint' : 'Publish viewpoint'}</button>}
      </div>}
    </div>}

    {selectedViewpointId && <div className="rounded-xl border border-stone-300 bg-white p-5 shadow-xs">
      <h3 className="font-serif text-lg font-bold text-stone-900">Database-backed hotspots</h3><p className="mt-1 text-xs text-stone-600">Positions use heading and pitch; targets must exist in ABHILEKH records.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2"><input placeholder="Hotspot title" aria-label="Hotspot title" value={hotspotForm.title} onChange={event => setHotspotForm({ ...hotspotForm, title: event.target.value })} className="rounded-lg border border-stone-300 p-2 text-sm" /><input placeholder="Short description" aria-label="Hotspot description" value={hotspotForm.description} onChange={event => setHotspotForm({ ...hotspotForm, description: event.target.value })} className="rounded-lg border border-stone-300 p-2 text-sm" />
        <label className="text-xs">Heading (degrees)<input type="number" min="-360" max="360" value={hotspotForm.heading} onChange={event => setHotspotForm({ ...hotspotForm, heading: Number(event.target.value) })} className="mt-1 block w-full rounded-lg border border-stone-300 p-2" /></label>
        <label className="text-xs">Pitch (degrees)<input type="number" min="-90" max="90" value={hotspotForm.pitch} onChange={event => setHotspotForm({ ...hotspotForm, pitch: Number(event.target.value) })} className="mt-1 block w-full rounded-lg border border-stone-300 p-2" /></label>
        <label className="text-xs">Target type<select value={hotspotForm.targetType} onChange={event => setHotspotForm({ ...hotspotForm, targetType: event.target.value })} className="mt-1 block w-full rounded-lg border border-stone-300 p-2"><option value="none">No navigation target</option><option value="archive_item">Archive item</option><option value="document">Document</option><option value="person">Person</option><option value="event">Event</option><option value="media">Media record</option><option value="knowledge_node">Knowledge graph node</option><option value="viewpoint">Another viewpoint</option></select></label>
        <input placeholder={hotspotForm.targetType === 'viewpoint' ? 'Target viewpoint ID' : 'Existing record ID'} aria-label="Hotspot target" value={hotspotForm.targetType === 'viewpoint' ? hotspotForm.targetViewpointId : hotspotForm.targetId} onChange={event => setHotspotForm({ ...hotspotForm, ...(hotspotForm.targetType === 'viewpoint' ? { targetViewpointId: event.target.value } : { targetId: event.target.value }) })} className="rounded-lg border border-stone-300 p-2 text-sm" />
        <button disabled={loading} onClick={() => void saveHotspot()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-stone-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" />{selectedHotspotId ? 'Update hotspot' : 'Create hotspot'}</button>
      </div>
      <div className="mt-4 divide-y divide-stone-200">{hotspots.map(hotspot => <div key={hotspot.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs"><span><strong>{hotspot.title}</strong><span className="ml-2 text-stone-500">heading {hotspot.heading}Â°, pitch {hotspot.pitch}Â° Â· {hotspot.target_type}</span></span><span className="flex gap-2"><button onClick={() => { setSelectedHotspotId(hotspot.id); setHotspotForm({ title: hotspot.title, description: hotspot.description, heading: Number(hotspot.heading), pitch: Number(hotspot.pitch), targetType: hotspot.target_type, targetId: hotspot.target_id || '', targetViewpointId: hotspot.target_viewpoint_id || '' }); }} className="rounded border border-stone-300 px-2 py-1">Edit</button><button disabled={loading} onClick={() => void run(async () => { await jsonRequest(`/api/heritage/admin/hotspots/${encodeURIComponent(hotspot.id)}`, 'DELETE'); setNotice('Hotspot removed.'); })} aria-label={`Remove hotspot ${hotspot.title}`} className="rounded border border-red-200 px-2 py-1 text-red-700"><Trash2 className="h-3.5 w-3.5" /></button></span></div>)}</div>
      {hotspots.length === 0 && <p className="mt-4 text-xs text-stone-500">No hotspots are stored for this viewpoint.</p>}
    </div>}

    {error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</div>}
    {notice && <div role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900"><Check className="mr-2 inline h-4 w-4" />{notice}</div>}
    {locations.length === 0 && !error && <div className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-600">No heritage locations exist in the database. Add only locations supported by verified records.</div>}
  </div>;
};

