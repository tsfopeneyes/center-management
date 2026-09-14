import React, { useEffect, useState } from 'react';
import { feedbackApi } from '../../../../../api/feedbackApi';
import ProgramSurveyResults from '../../../../surveys/ProgramSurveyResults';

export default function FeedbackResults({ notice, onClose }) {
    const [rows, setRows] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
    useEffect(() => { let active=true; setLoading(true); feedbackApi.fetchFeedbackByNotice(notice.id).then(data=>{if(active)setRows(data);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);}); return ()=>{active=false;}; }, [notice.id]);
    return <ProgramSurveyResults program={notice} feedbacks={rows} onClose={onClose} loading={loading} error={error} />;
}
