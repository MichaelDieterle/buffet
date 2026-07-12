module.exports = (sequelize, DataTypes) => {
  const CalendarEvent = sequelize.define('CalendarEvent', {
    type: { type: DataTypes.STRING, allowNull: false },
    eventDate: DataTypes.DATE,
    description: DataTypes.TEXT,
  }, { timestamps: true });

  CalendarEvent.associate = (models) => {
    CalendarEvent.belongsTo(models.Stock, { foreignKey: 'stockId', as: 'stock' });
  };

  return CalendarEvent;
};
