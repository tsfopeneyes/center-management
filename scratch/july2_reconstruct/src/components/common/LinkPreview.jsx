import React from 'react';
import Microlink from '@microlink/react';

const LinkPreview = ({ url, size = 'normal' }) => {
    if (!url) return null;

    return (
        <div className="my-2 max-w-full overflow-hidden rounded-xl border border-gray-100 shadow-sm">
            <Microlink
                url={url}
                size={size}
                style={{
                    width: '100%',
                    border: 'none',
                    borderRadius: '12px',
                    fontFamily: 'inherit'
                }}
            />
        </div>
    );
};

export default LinkPreview;
