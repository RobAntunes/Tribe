import React from "react";

interface TribeProps {
  className?: string;
}

const Tribe: React.FC<TribeProps> = ({ className = "" }) => {
  return (
    <div className={`bg-transparent relative ${className}`}>
      <img 
        src={(window as any).__vscMediaPath + '/tribe.svg'} 
        alt="Tribe Logo"
        style={{ width: '24px', height: '24px' }} 
      />
    </div>
  );
};

export default Tribe;
