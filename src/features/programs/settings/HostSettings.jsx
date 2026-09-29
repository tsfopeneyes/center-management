import React from 'react';
import PropTypes from 'prop-types';
import { Users, ChevronUp, ChevronDown, MessageSquare, ToggleLeft, ToggleRight } from 'lucide-react';
import { userApi } from '../../../api/userApi';

const HostSettings = ({ formData, updateField }) => {
    // Single Source of Truth for Host Active State
    const isHostActive = formData.enable_hosts === true;

    // Cache last hosts to restore if user toggles off/on
    const savedHostsRef = React.useRef(
        (Array.isArray(formData.hosts) && formData.hosts.length > 0)
            ? formData.hosts
            : (formData.host_id ? [{ host_id: formData.host_id, one_liner: formData.host_one_liner || '' }] : [])
    );

    React.useEffect(() => {
        if (Array.isArray(formData.hosts) && formData.hosts.length > 0) {
            savedHostsRef.current = formData.hosts;
        }
    }, [formData.hosts]);

    const [admins, setAdmins] = React.useState([]);

    React.useEffect(() => {
        const fetchAdmins = async () => {
            try {
                setAdmins(await userApi.fetchStaff());
            } catch (err) {
                console.error('Error fetching admins:', err);
            }
        };
        fetchAdmins();
    }, []);

    return (
        <>
            {(!formData.program_type || formData.program_type === 'CENTER') && (
                <div className={`bg-white border rounded-2xl overflow-hidden shadow-sm transition-all duration-200 ${
                    isHostActive ? 'border-blue-300 shadow-md' : 'border-slate-200/80 hover:border-slate-300'
                }`}>
                    <button
                        type="button"
                        onClick={() => {
                            const nextState = !isHostActive;
                            if (!nextState) {
                                if (Array.isArray(formData.hosts) && formData.hosts.length > 0) {
                                    savedHostsRef.current = formData.hosts;
                                }
                                updateField('enable_hosts', false);
                            } else {
                                updateField('enable_hosts', true);
                                const hostsToRestore = (savedHostsRef.current && Array.isArray(savedHostsRef.current) && savedHostsRef.current.length > 0)
                                    ? savedHostsRef.current
                                    : [{ host_id: formData.host_id || '', one_liner: formData.host_one_liner || '' }];
                                updateField('hosts', hostsToRestore);
                                if (hostsToRestore[0]?.host_id) {
                                    updateField('host_id', hostsToRestore[0].host_id);
                                    updateField('host_one_liner', hostsToRestore[0].one_liner || '');
                                }
                            }
                        }}
                        className="w-full p-4 sm:p-5 flex items-center justify-between bg-white hover:bg-slate-50/60 transition-colors cursor-pointer select-none"
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl transition-colors ${
                                isHostActive ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'
                            }`}>
                                <Users size={18} />
                            </div>
                            <div className="flex flex-col items-start text-left">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-bold text-slate-800">호스트(진행자) 설정</span>
                                    <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-md border ${
                                        isHostActive ? 'bg-blue-50 text-blue-600 border-blue-200/60' : 'bg-slate-100 text-slate-500 border-slate-200/60'
                                    }`}>
                                        {isHostActive ? '호스트 지정 (활성화)' : '미사용 (비활성화)'}
                                    </span>
                                </div>
                                <span className="text-[11px] text-slate-400 font-medium mt-0.5">프로그램을 담당하여 진행할 전담 호스트를 지정합니다.</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {isHostActive ? (
                                <ToggleRight size={28} className="text-blue-600" />
                            ) : (
                                <ToggleLeft size={28} className="text-slate-300" />
                            )}
                            {isHostActive ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                        </div>
                    </button>

                    {isHostActive && (
                        <div className="p-5 pt-3 border-t border-slate-100 bg-slate-50/40 space-y-4 animate-fade-in">
                            {(() => {
                                const currentHosts = (formData.hosts && Array.isArray(formData.hosts)) && formData.hosts.length > 0
                                    ? formData.hosts
                                    : [{ host_id: formData.host_id || '', one_liner: formData.host_one_liner || '' }];
                                return (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            {currentHosts.map((host, index) => (
                                                <div key={index} className="bg-white border border-slate-200/60 rounded-xl p-4 space-y-3 relative transition-all hover:border-blue-400 shadow-sm">
                                                    <div className="flex justify-between items-center pb-2 border-b border-slate-200/40">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-extrabold text-[11px] text-slate-500">호스트 #{index + 1}</span>
                                                            <div className="flex gap-0.5">
                                                                <button
                                                                    type="button"
                                                                    disabled={index === 0}
                                                                    onClick={() => {
                                                                        if (index === 0) return;
                                                                        const nextHosts = [...currentHosts];
                                                                        const temp = nextHosts[index];
                                                                        nextHosts[index] = nextHosts[index - 1];
                                                                        nextHosts[index - 1] = temp;
                                                                        updateField('hosts', nextHosts);
                                                                    }}
                                                                    className={`p-0.5 rounded hover:bg-slate-200/80 transition ${index === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500'}`}
                                                                    title="위로 이동"
                                                                >
                                                                    <ChevronUp size={13} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={index === currentHosts.length - 1}
                                                                    onClick={() => {
                                                                        if (index === currentHosts.length - 1) return;
                                                                        const nextHosts = [...currentHosts];
                                                                        const temp = nextHosts[index];
                                                                        nextHosts[index] = nextHosts[index + 1];
                                                                        nextHosts[index + 1] = temp;
                                                                        updateField('hosts', nextHosts);
                                                                    }}
                                                                    className={`p-0.5 rounded hover:bg-slate-200/80 transition ${index === currentHosts.length - 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500'}`}
                                                                    title="아래로 이동"
                                                                >
                                                                    <ChevronDown size={13} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        {currentHosts.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const nextHosts = currentHosts.filter((_, i) => i !== index);
                                                                    updateField('hosts', nextHosts);
                                                                    if (nextHosts[0]?.host_id) {
                                                                        updateField('host_id', nextHosts[0].host_id);
                                                                        updateField('host_one_liner', nextHosts[0].one_liner || '');
                                                                    }
                                                                }}
                                                                className="text-[10px] font-black text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100/80 px-2 py-1 rounded-lg transition-colors"
                                                            >
                                                                삭제
                                                            </button>
                                                        )}
                                                    </div>

                                                    <div className="space-y-3">
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-xs font-bold text-slate-500 mb-1 block">호스트 지정</label>
                                                            <div className="h-10 relative flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all px-3">
                                                                <Users className="text-slate-400 shrink-0 mr-2" size={14} />
                                                                <select
                                                                    value={host.host_id || ''}
                                                                    onChange={e => {
                                                                        const nextHosts = [...currentHosts];
                                                                        nextHosts[index] = { ...nextHosts[index], host_id: e.target.value };
                                                                        updateField('hosts', nextHosts);
                                                                        updateField('host_id', nextHosts[0]?.host_id || '');
                                                                        updateField('host_one_liner', nextHosts[0]?.one_liner || '');
                                                                    }}
                                                                    className="w-full bg-transparent outline-none font-bold text-slate-800 text-xs cursor-pointer"
                                                                >
                                                                    <option value="">호스트 선택</option>
                                                                    {(() => {
                                                                        const selectedInOtherCards = currentHosts
                                                                            .filter((_, i) => i !== index)
                                                                            .map(h => h.host_id)
                                                                            .filter(Boolean);
                                                                        const availableAdmins = admins.filter(a => !selectedInOtherCards.includes(a.id));
                                                                        return availableAdmins.map(admin => {
                                                                            const hasNoSchoolOrHaifn = !admin.school || admin.school === '더작은재단';
                                                                            const optionText = hasNoSchoolOrHaifn ? admin.name : `${admin.name} (${admin.school})`;
                                                                            return (
                                                                                <option key={admin.id} value={admin.id}>
                                                                                    {optionText}
                                                                                </option>
                                                                            );
                                                                        });
                                                                    })()}
                                                                </select>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-xs font-bold text-slate-500 mb-1 block">호스트 한마디</label>
                                                            <div className="h-10 relative flex items-center bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all px-3">
                                                                <MessageSquare className="text-slate-400 shrink-0 mr-2" size={14} />
                                                                <input
                                                                    type="text"
                                                                    placeholder="호스트의 다짐이나 한마디를 입력해주세요."
                                                                    value={host.one_liner || ''}
                                                                    onChange={e => {
                                                                        const nextHosts = [...currentHosts];
                                                                        nextHosts[index] = { ...nextHosts[index], one_liner: e.target.value };
                                                                        updateField('hosts', nextHosts);
                                                                        updateField('host_one_liner', nextHosts[0]?.one_liner || '');
                                                                    }}
                                                                    className="w-full bg-transparent outline-none font-bold text-slate-800 text-xs"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const nextHosts = [...currentHosts, { host_id: '', one_liner: '' }];
                                                updateField('hosts', nextHosts);
                                            }}
                                            className="w-full py-3 border border-dashed border-slate-200 hover:border-blue-500 rounded-xl font-bold text-slate-500 hover:text-blue-600 bg-white hover:bg-blue-50/20 transition-all text-xs flex items-center justify-center gap-1.5"
                                        >
                                            + 호스트 추가
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

HostSettings.propTypes = {
    formData: PropTypes.object.isRequired,
    updateField: PropTypes.func.isRequired,
};

export default HostSettings;
