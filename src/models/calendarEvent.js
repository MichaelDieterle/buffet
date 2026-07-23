module.exports = (sequelize, DataTypes) => {
  const CalendarEvent = sequelize.define('CalendarEvent', {
    type: { type: DataTypes.STRING, allowNull: false },
    eventDate: DataTypes.DATE,
    description: DataTypes.TEXT,
  }, {
    timestamps: true,
    indexes: [
      { unique: true, fields: ['stockId', 'type', 'eventDate'] }
    ],
  });

  CalendarEvent.associate = (models) => {
    CalendarEvent.belongsTo(models.Stock, { foreignKey: 'stockId', as: 'stock' });
  };

  return CalendarEvent;
};
