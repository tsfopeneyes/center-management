import React from 'react';
import { Settings, X, Check } from 'lucide-react';
import Cropper from 'react-easy-crop';

// Custom Hooks
import useAdminSettings from './hooks/useAdminSettings';

// Modular Sections
import ProfileSettings from './components/ProfileSettings';
import LocationManager from './components/LocationManager';
import IntegrationConfig from './components/IntegrationConfig';
import LayoutDesigner from './components/LayoutDesigner';

const AdminSettings = ({ currentAdmin, locations, locationGroups = [], notices, fetchData, users, allLogs, responses = [], schoolLogs = [] }) => {
    const isMaster = currentAdmin?.is_master || currentAdmin?.name === 'Rok' || currentAdmin?.name === 'admin';

    const {
        profilePreview,
        newAdminPassword, setNewAdminPassword,
        confirmAdminPassword, setConfirmAdminPassword,
        profileLoading,
        showEditor, setShowEditor,
        editorImageSrc,
        crop, setCrop,
        zoom, setZoom,
        rotation, setRotation,
        handleAdminProfileImageSelect, handleSaveCroppedImage, handleSaveAdminProfile,

        gsWebhookUrl, setGsWebhookUrl,
        notionApiKey, setNotionApiKey,
        notionDbId, setNotionDbId,
        kioskMasterPin, setKioskMasterPin,
        isBackingUp, isUploadingNotion, syncProgress,
        handleSaveIntegrations, handleGoogleSheetsBackup, handleNotionUpload,

        tempGroupName, setTempGroupName,
        editGroupId, setEditGroupId,
        selectedGroupIdForLocation, setSelectedGroupIdForLocation,
        tempLocationName, setTempLocationName,
        editLocationId, setEditLocationId,
        handleAddGroup, handleUpdateGroup, handleDeleteGroup,
        handleAddLocation, handleUpdateLocation, handleDeleteLocation,

        dashboardConfig, sidebarConfig,
        configLoading, sidebarConfigLoading,
        handleMoveConfig, handleUpdateConfig, handleSaveDashboardConfig,
        handleMoveSidebarConfig, handleUpdateSidebarConfig, handleSaveSidebarConfig
    } = useAdminSettings({
        currentAdmin, locations, locationGroups, fetchData, users, allLogs, responses, schoolLogs, notices
    });

    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in-up">
            <div className="p-4 md:p-10 bg-white rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm flex flex-col lg:flex-row gap-4 lg:gap-6 items-start lg:items-center justify-between bg-gradient-to-r from-white to-blue-50/20">
                <div>
                    <h2 className="text-xl md:text-3xl font-black text-gray-800 tracking-tighter flex items-center gap-2 md:gap-3">
                        <Settings className="text-blue-600" size={24} md:size={32} />
                        시스템 설정
                    </h2>
                    <p className="hidden md:block text-gray-500 text-sm font-medium mt-1">센터 기본 정보 및 보안, 연동 설정 관리</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ProfileSettings
                    currentAdmin={currentAdmin}
                    profilePreview={profilePreview}
                    newAdminPassword={newAdminPassword}
                    setNewAdminPassword={setNewAdminPassword}
                    confirmAdminPassword={confirmAdminPassword}
                    setConfirmAdminPassword={setConfirmAdminPassword}
                    profileLoading={profileLoading}
                    handleAdminProfileImageSelect={handleAdminProfileImageSelect}
                    handleSaveAdminProfile={handleSaveAdminProfile}
                />

                <LocationManager
                    isMaster={isMaster}
                    locations={locations}
                    locationGroups={locationGroups}
                    tempGroupName={tempGroupName}
                    setTempGroupName={setTempGroupName}
                    handleAddGroup={handleAddGroup}
                    editGroupId={editGroupId}
                    setEditGroupId={setEditGroupId}
                    handleUpdateGroup={handleUpdateGroup}
                    handleDeleteGroup={handleDeleteGroup}
                    selectedGroupIdForLocation={selectedGroupIdForLocation}
                    setSelectedGroupIdForLocation={setSelectedGroupIdForLocation}
                    tempLocationName={tempLocationName}
                    setTempLocationName={setTempLocationName}
                    handleAddLocation={handleAddLocation}
                    editLocationId={editLocationId}
                    setEditLocationId={setEditLocationId}
                    handleUpdateLocation={handleUpdateLocation}
                    handleDeleteLocation={handleDeleteLocation}
                />
            </div>

            {isMaster && (
                <>
                    <IntegrationConfig
                        gsWebhookUrl={gsWebhookUrl}
                        setGsWebhookUrl={setGsWebhookUrl}
                        notionApiKey={notionApiKey}
                        setNotionApiKey={setNotionApiKey}
                        notionDbId={notionDbId}
                        setNotionDbId={setNotionDbId}
                        kioskMasterPin={kioskMasterPin}
                        setKioskMasterPin={setKioskMasterPin}
                        isBackingUp={isBackingUp}
                        isUploadingNotion={isUploadingNotion}
                        syncProgress={syncProgress}
                        handleSaveIntegrations={handleSaveIntegrations}
                        handleGoogleSheetsBackup={handleGoogleSheetsBackup}
                        handleNotionUpload={handleNotionUpload}
                    />

                    <LayoutDesigner
                        dashboardConfig={dashboardConfig}
                        sidebarConfig={sidebarConfig}
                        configLoading={configLoading}
                        sidebarConfigLoading={sidebarConfigLoading}
                        handleMoveConfig={handleMoveConfig}
                        handleUpdateConfig={handleUpdateConfig}
                        handleSaveDashboardConfig={handleSaveDashboardConfig}
                        handleMoveSidebarConfig={handleMoveSidebarConfig}
                        handleUpdateSidebarConfig={handleUpdateSidebarConfig}
                        handleSaveSidebarConfig={handleSaveSidebarConfig}
                    />
                </>
            )}

            {/* Cropper Modal */}
            {showEditor && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden flex flex-col h-[80vh] md:h-auto shadow-2xl">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100">
                            <h3 className="text-xl font-bold text-gray-800">프로필 사진 조절</h3>
                            <button onClick={() => setShowEditor(false)} className="text-gray-400 hover:text-gray-600 transition p-2 rounded-full hover:bg-gray-100"><X size={24} /></button>
                        </div>
                        <div className="relative w-full flex-1 md:h-96 bg-gray-900">
                            <Cropper
                                image={editorImageSrc}
                                crop={crop}
                                zoom={zoom}
                                rotation={rotation}
                                aspect={1}
                                onCropChange={setCrop}
                                onCropComplete={(croppedArea, croppedAreaPixels) => setCroppedAreaPixels(croppedAreaPixels)}
                                onZoomChange={setZoom}
                                onRotationChange={setRotation}
                                cropShape="round"
                                showGrid={false}
                            />
                        </div>
                        <div className="p-6 bg-gray-50 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-2 block">확대/축소</label>
                                <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(e.target.value)} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-2 block">회전</label>
                                <input type="range" min={0} max={360} step={1} value={rotation} onChange={(e) => setRotation(e.target.value)} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-2">
                                <button onClick={() => setShowEditor(false)} className="px-6 py-3 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition text-sm">취소</button>
                                <button onClick={handleSaveCroppedImage} className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-lg flex items-center gap-2 text-sm"><Check size={18} /> 반영하기</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminSettings;
