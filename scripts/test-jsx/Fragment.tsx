import React from 'react';

const Test: React.FC = () => {
  return (
    <>
      <div className="modal">
        <div className="inner">
          content
        </div>
      </div>

      {true && (
        <div className="popup">
          <div className="inner-popup">
            popup content
          </div>
        </div>
      )}
    </>
  );
};

export default Test;